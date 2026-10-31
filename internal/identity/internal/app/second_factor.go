package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

var (
	ErrTOTPEnabled         = errors.New("totp already enabled")
	ErrTOTPCodeInvalid     = errors.New("totp code invalid")
	ErrPasswordInvalid     = errors.New("password invalid")
	ErrPasskeyInvalid      = errors.New("passkey invalid")
	ErrPasskeyNotFound     = errors.New("passkey not found")
	ErrSecondFactorInvalid = errors.New("second factor invalid")
	ErrSecondFactorMissing = errors.New("no second factor")
	ErrSecretKeyMissing    = errors.New("EQUORI_SECRET_KEY is not set")
)

const (
	MethodPassword     = "password"
	MethodTOTP         = "totp"
	MethodPasskey      = "passkey"
	MethodRecoveryCode = "recovery_code"

	// secondFactorAttempts ends a pending login at the fifth wrong value (HA47).
	secondFactorAttempts = 5
)

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

type SecondFactor struct {
	TOTP              bool
	Passkeys          []domain.Passkey
	RecoveryCodesLeft int
}

// FirstFactor is applied when a member enables its first second factor (HA37).
type FirstFactor struct {
	Hashes      [][]byte
	KeepSession []byte
	At          time.Time
}

type PendingLogin struct {
	Token     string
	ExpiresAt time.Time
	Methods   []string
	Passkey   *PasskeyRequest
}

type PasskeyRequest struct {
	Challenge        []byte
	AllowCredentials [][]byte
}

type PasskeyOptions struct {
	Challenge          []byte
	UserID             []byte
	UserName           string
	ExcludeCredentials [][]byte
}

type PasskeyInput struct {
	Name                                         string
	ClientDataJSON, AuthenticatorData, PublicKey []byte
	Algorithm                                    int
}

// SecondFactorAnswer holds exactly one value.
type SecondFactorAnswer struct {
	TOTPCode     string
	RecoveryCode string
	Passkey      *Assertion
}

type Assertion struct {
	CredentialID, ClientDataJSON, AuthenticatorData, Signature []byte
}

type SecondFactorLogin struct {
	Session           Session
	Method            string
	RecoveryCodesLeft int
}

type SecondFactorRepository interface {
	SecondFactor(ctx context.Context, memberID int64) (SecondFactor, error)
	HasSecondFactor(ctx context.Context, memberID int64) (bool, error)
	// SaveTOTP stores an unconfirmed secret; ErrTOTPEnabled when a confirmed one exists.
	SaveTOTP(ctx context.Context, memberID int64, sealed []byte, at time.Time) error
	// TOTP returns ErrNotFound without a row.
	TOTP(ctx context.Context, memberID int64) (domain.TOTP, error)
	// ConfirmTOTP confirms at step under a lock of the member row and applies f when no factor
	// existed, reported as first; ErrTOTPCodeInvalid when no unconfirmed row has last_step below step.
	ConfirmTOTP(ctx context.Context, memberID, step int64, f FirstFactor) (first bool, err error)
	// AddPasskey is ConfirmTOTP for a new passkey; ErrPasskeyInvalid when the credential ID exists.
	AddPasskey(ctx context.Context, p domain.Passkey, f FirstFactor) (first bool, err error)
	// DisableTOTP and RemovePasskey delete the recovery codes when no factor is left; RemovePasskey
	// returns ErrPasskeyNotFound.
	DisableTOTP(ctx context.Context, memberID int64) error
	RemovePasskey(ctx context.Context, memberID int64, id uuid.UUID) error
	// ReplaceRecoveryCodes returns ErrSecondFactorMissing without a factor.
	ReplaceRecoveryCodes(ctx context.Context, memberID int64, hashes [][]byte, at time.Time) error
	SavePasskeyChallenge(ctx context.Context, memberID int64, challenge []byte, expiresAt time.Time) error
	// TakePasskeyChallenge deletes the row; ErrNotFound without one or when it expired at now.
	TakePasskeyChallenge(ctx context.Context, memberID int64, now time.Time) ([]byte, error)
	// UseTOTPStep, UseRecoveryCode and UsePasskey return false for a refused factor.
	UseTOTPStep(ctx context.Context, memberID, step int64) (bool, error)
	UseRecoveryCode(ctx context.Context, memberID int64, hash []byte) (left int, ok bool, err error)
	UsePasskey(ctx context.Context, memberID int64, id uuid.UUID, signCount uint32, at time.Time) (bool, error)
	CreateLoginChallenge(ctx context.Context, c domain.LoginChallenge) error
	// LoginChallenge returns ErrNotFound for an unknown or expired token hash.
	LoginChallenge(ctx context.Context, tokenHash []byte, now time.Time) (domain.LoginChallenge, error)
	// FailLoginChallenge counts a wrong value and deletes the row when the count reaches limit.
	FailLoginChallenge(ctx context.Context, tokenHash []byte, limit int) error
	// DeleteLoginChallenge returns false when no row was deleted.
	DeleteLoginChallenge(ctx context.Context, tokenHash []byte) (bool, error)
	DeleteExpiredLoginChallenges(ctx context.Context, now time.Time) error
	// ResetSecondFactor deletes every factor, challenge, pending login and session of the member in
	// one transaction (HA49).
	ResetSecondFactor(ctx context.Context, memberID int64) error
	// ResealTOTP stores each non-nil result of reseal; it returns the count stored.
	ResealTOTP(ctx context.Context, reseal func(memberID int64, sealed []byte) ([]byte, error)) (int, error)
}

func (s *Service) UseSealer(box Sealer) { s.box = box }

func (s *Service) SecondFactor(ctx context.Context, memberID int64) (SecondFactor, error) {
	return s.repo.SecondFactor(ctx, memberID)
}

// StartTOTP stores a new unconfirmed secret and returns it with its otpauth URI.
func (s *Service) StartTOTP(ctx context.Context, memberID int64) (secret []byte, uri string, err error) {
	if s.box == nil {
		return nil, "", ErrSecretKeyMissing
	}

	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return nil, "", fmt.Errorf("load member %d: %w", memberID, err)
	}

	secret = domain.NewTOTPSecret()

	sealed, err := s.box.Seal(secret, domain.TOTPRow(memberID))
	if err != nil {
		return nil, "", fmt.Errorf("seal totp secret: %w", err)
	}

	if err := s.repo.SaveTOTP(ctx, memberID, sealed, s.now()); err != nil {
		return nil, "", err
	}

	return secret, domain.TOTPURI(member.Email, secret), nil
}

// ConfirmTOTP enables the stored secret; it returns the recovery codes when no second factor existed.
func (s *Service) ConfirmTOTP(ctx context.Context, memberID int64, sessionToken, code string) ([]string, error) {
	if s.box == nil {
		return nil, ErrSecretKeyMissing
	}

	stored, err := s.repo.TOTP(ctx, memberID)
	switch {
	case errors.Is(err, ErrNotFound):
		return nil, ErrTOTPCodeInvalid
	case err != nil:
		return nil, fmt.Errorf("load totp of member %d: %w", memberID, err)
	case stored.Confirmed:
		return nil, ErrTOTPEnabled
	}

	secret, err := s.box.Open(stored.Sealed, domain.TOTPRow(memberID))
	if err != nil {
		return nil, fmt.Errorf("open totp secret of member %d: %w", memberID, err)
	}

	now := s.now()

	step, ok := domain.MatchTOTP(secret, code, now, stored.LastStep)
	if !ok {
		return nil, ErrTOTPCodeInvalid
	}

	codes, hashes := domain.NewRecoveryCodes()

	first, err := s.repo.ConfirmTOTP(ctx, memberID, step, FirstFactor{
		Hashes:      hashes,
		KeepSession: domain.HashToken(sessionToken),
		At:          now,
	})
	if err != nil {
		return nil, err
	}

	if !first {
		return nil, nil
	}

	return codes, nil
}

// DisableTOTP deletes the secret after the password check.
func (s *Service) DisableTOTP(ctx context.Context, memberID int64, password string) error {
	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return fmt.Errorf("load member %d: %w", memberID, err)
	}

	if err := s.checkPassword(ctx, member, password); err != nil {
		return err
	}

	return s.repo.DisableTOTP(ctx, memberID)
}

// RegenerateRecoveryCodes replaces every recovery code after the password check.
func (s *Service) RegenerateRecoveryCodes(ctx context.Context, memberID int64, password string) ([]string, error) {
	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("load member %d: %w", memberID, err)
	}

	if err := s.checkPassword(ctx, member, password); err != nil {
		return nil, err
	}

	codes, hashes := domain.NewRecoveryCodes()
	if err := s.repo.ReplaceRecoveryCodes(ctx, memberID, hashes, s.now()); err != nil {
		return nil, err
	}

	return codes, nil
}

// PasskeyOptions stores a registration challenge and returns it with the credentials to exclude.
func (s *Service) PasskeyOptions(ctx context.Context, memberID int64, origin string) (PasskeyOptions, error) {
	rpID, ok := domain.RPID(origin)
	if !ok {
		return PasskeyOptions{}, ErrPasskeyInvalid
	}

	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return PasskeyOptions{}, fmt.Errorf("load member %d: %w", memberID, err)
	}

	state, err := s.repo.SecondFactor(ctx, memberID)
	if err != nil {
		return PasskeyOptions{}, fmt.Errorf("load second factor of member %d: %w", memberID, err)
	}

	challenge := domain.NewChallenge(32)

	if err := s.repo.SavePasskeyChallenge(ctx, memberID, challenge, s.now().Add(domain.ChallengeTTL)); err != nil {
		return PasskeyOptions{}, fmt.Errorf("save passkey challenge of member %d: %w", memberID, err)
	}

	exclude := make([][]byte, 0, len(state.Passkeys))

	for _, p := range state.Passkeys {
		if p.RPID == rpID {
			exclude = append(exclude, p.CredentialID)
		}
	}

	return PasskeyOptions{
		Challenge:          challenge,
		UserID:             domain.NewChallenge(16),
		UserName:           member.Email,
		ExcludeCredentials: exclude,
	}, nil
}

// CreatePasskey verifies a creation ceremony and stores the passkey; it returns the recovery codes
// when no second factor existed. The challenge is consumed in every outcome.
func (s *Service) CreatePasskey(ctx context.Context, memberID int64, sessionToken, origin string, in PasskeyInput) (domain.Passkey, []string, error) {
	now := s.now()

	challenge, err := s.repo.TakePasskeyChallenge(ctx, memberID, now)
	switch {
	case errors.Is(err, ErrNotFound):
		return domain.Passkey{}, nil, ErrPasskeyInvalid
	case err != nil:
		return domain.Passkey{}, nil, fmt.Errorf("take passkey challenge of member %d: %w", memberID, err)
	}

	rpID, ok := domain.RPID(origin)
	if !ok {
		return domain.Passkey{}, nil, ErrPasskeyInvalid
	}

	reg, err := domain.VerifyRegistration(in.ClientDataJSON, in.AuthenticatorData, in.PublicKey, in.Algorithm, challenge, origin)
	if err != nil {
		return domain.Passkey{}, nil, ErrPasskeyInvalid
	}

	passkey := domain.Passkey{
		ID:           uuid.New(),
		MemberID:     memberID,
		CredentialID: reg.CredentialID,
		PublicKey:    reg.PublicKey,
		Algorithm:    reg.Algorithm,
		SignCount:    reg.SignCount,
		RPID:         rpID,
		Name:         in.Name,
		CreatedAt:    now,
	}
	codes, hashes := domain.NewRecoveryCodes()

	first, err := s.repo.AddPasskey(ctx, passkey, FirstFactor{
		Hashes:      hashes,
		KeepSession: domain.HashToken(sessionToken),
		At:          now,
	})
	if err != nil {
		return domain.Passkey{}, nil, err
	}

	if !first {
		return passkey, nil, nil
	}

	return passkey, codes, nil
}

// RemovePasskey deletes the passkey after the password check.
func (s *Service) RemovePasskey(ctx context.Context, memberID int64, id uuid.UUID, password string) error {
	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return fmt.Errorf("load member %d: %w", memberID, err)
	}

	if err := s.checkPassword(ctx, member, password); err != nil {
		return err
	}

	return s.repo.RemovePasskey(ctx, memberID, id)
}

// RotateSecrets reseals every TOTP secret under the current key; ErrSecretKeyMissing without a box.
func (s *Service) RotateSecrets(ctx context.Context) (int, error) {
	if s.box == nil {
		return 0, ErrSecretKeyMissing
	}

	return s.repo.ResealTOTP(ctx, func(memberID int64, sealed []byte) ([]byte, error) {
		if !s.box.NeedsReseal(sealed) {
			return nil, nil
		}

		plain, err := s.box.Open(sealed, domain.TOTPRow(memberID))
		if err != nil {
			return nil, fmt.Errorf("member %d: %w", memberID, err)
		}

		return s.box.Seal(plain, domain.TOTPRow(memberID))
	})
}

// CompleteSecondFactor finishes a pending login with one answer. ErrSecondFactorInvalid is returned
// with the member of the pending login in Session.MemberID, for the log line.
func (s *Service) CompleteSecondFactor(ctx context.Context, loginToken, origin string, a SecondFactorAnswer) (SecondFactorLogin, error) {
	now := s.now()
	hash := domain.HashToken(loginToken)

	pending, err := s.repo.LoginChallenge(ctx, hash, now)
	switch {
	case errors.Is(err, ErrNotFound):
		return SecondFactorLogin{}, ErrUnauthenticated
	case err != nil:
		return SecondFactorLogin{}, fmt.Errorf("load pending login: %w", err)
	}

	result := SecondFactorLogin{Session: Session{MemberID: pending.MemberID}}

	method, left, ok, err := s.useSecondFactor(ctx, pending, origin, a, now)
	if err != nil {
		return result, err
	}

	if !ok {
		if err := s.repo.FailLoginChallenge(ctx, hash, secondFactorAttempts); err != nil {
			return result, fmt.Errorf("count wrong second factor of member %d: %w", pending.MemberID, err)
		}

		return result, ErrSecondFactorInvalid
	}

	session, err := s.finishSecondFactor(ctx, hash, pending.MemberID, now)
	if err != nil {
		return result, err
	}

	return SecondFactorLogin{Session: session, Method: method, RecoveryCodesLeft: left}, nil
}

// ResetSecondFactor deletes the second factor, pending logins and sessions of the member with email (HA49).
func (s *Service) ResetSecondFactor(ctx context.Context, email string) (int64, error) {
	email, err := domain.NormalizeEmail(email)
	if err != nil {
		return 0, ErrNotFound
	}

	m, err := s.repo.MemberByEmail(ctx, email)
	if err != nil {
		return 0, err
	}

	if err := s.repo.ResetSecondFactor(ctx, m.ID); err != nil {
		return 0, err
	}

	return m.ID, nil
}

// startPendingLogin stores a pending login of the member and returns its token and methods.
func (s *Service) startPendingLogin(ctx context.Context, memberID int64, origin string, now time.Time) (*PendingLogin, error) {
	if _, err := s.repo.LoginBooks(ctx, memberID); errors.Is(err, ErrNotFound) {
		return nil, ErrInvalidCredentials
	} else if err != nil {
		return nil, fmt.Errorf("load login books of member %d: %w", memberID, err)
	}

	state, err := s.repo.SecondFactor(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("load second factor of member %d: %w", memberID, err)
	}

	if err := s.repo.DeleteExpiredLoginChallenges(ctx, now); err != nil {
		return nil, fmt.Errorf("delete expired pending logins: %w", err)
	}

	token, challenge := domain.NewLoginChallenge(memberID, now)
	if err := s.repo.CreateLoginChallenge(ctx, challenge); err != nil {
		return nil, fmt.Errorf("create pending login of member %d: %w", memberID, err)
	}

	pending := &PendingLogin{Token: token, ExpiresAt: challenge.ExpiresAt}

	if state.TOTP {
		pending.Methods = append(pending.Methods, MethodTOTP)
	}

	if allowed := credentialsOf(state.Passkeys, origin); len(allowed) > 0 {
		pending.Methods = append(pending.Methods, MethodPasskey)
		pending.Passkey = &PasskeyRequest{Challenge: challenge.Challenge, AllowCredentials: allowed}
	}

	pending.Methods = append(pending.Methods, MethodRecoveryCode)

	return pending, nil
}

// credentialsOf returns the credential IDs of the passkeys with the RP ID of origin.
func credentialsOf(passkeys []domain.Passkey, origin string) [][]byte {
	rpID, ok := domain.RPID(origin)
	if !ok {
		return nil
	}

	var ids [][]byte

	for _, p := range passkeys {
		if p.RPID == rpID {
			ids = append(ids, p.CredentialID)
		}
	}

	return ids
}

// useSecondFactor consumes the factor of the answer; ok is false for a refused value.
func (s *Service) useSecondFactor(ctx context.Context, pending domain.LoginChallenge, origin string, a SecondFactorAnswer, now time.Time) (method string, left int, ok bool, err error) {
	switch {
	case a.TOTPCode != "":
		ok, err = s.useTOTP(ctx, pending.MemberID, a.TOTPCode, now)

		return MethodTOTP, 0, ok, err
	case a.RecoveryCode != "":
		left, ok, err = s.useRecoveryCode(ctx, pending.MemberID, a.RecoveryCode)

		return MethodRecoveryCode, left, ok, err
	case a.Passkey != nil:
		ok, err = s.usePasskey(ctx, pending, origin, *a.Passkey, now)

		return MethodPasskey, 0, ok, err
	}

	return "", 0, false, nil
}

func (s *Service) useTOTP(ctx context.Context, memberID int64, code string, now time.Time) (bool, error) {
	if s.box == nil {
		return false, ErrSecretKeyMissing
	}

	stored, err := s.repo.TOTP(ctx, memberID)
	switch {
	case errors.Is(err, ErrNotFound):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("load totp of member %d: %w", memberID, err)
	case !stored.Confirmed:
		return false, nil
	}

	secret, err := s.box.Open(stored.Sealed, domain.TOTPRow(memberID))
	if err != nil {
		return false, fmt.Errorf("open totp secret of member %d: %w", memberID, err)
	}

	step, ok := domain.MatchTOTP(secret, code, now, stored.LastStep)
	if !ok {
		return false, nil
	}

	return s.repo.UseTOTPStep(ctx, memberID, step)
}

func (s *Service) useRecoveryCode(ctx context.Context, memberID int64, code string) (int, bool, error) {
	hash, ok := domain.HashRecoveryCode(code)
	if !ok {
		return 0, false, nil
	}

	return s.repo.UseRecoveryCode(ctx, memberID, hash)
}

func (s *Service) usePasskey(ctx context.Context, pending domain.LoginChallenge, origin string, a Assertion, now time.Time) (bool, error) {
	state, err := s.repo.SecondFactor(ctx, pending.MemberID)
	if err != nil {
		return false, fmt.Errorf("load second factor of member %d: %w", pending.MemberID, err)
	}

	rpID, _ := domain.RPID(origin)

	for _, p := range state.Passkeys {
		if p.RPID != rpID || !bytes.Equal(p.CredentialID, a.CredentialID) {
			continue
		}

		counter, err := domain.VerifyAssertion(a.ClientDataJSON, a.AuthenticatorData, a.Signature, p.PublicKey, p.Algorithm, pending.Challenge, origin)
		if err != nil {
			return false, nil
		}

		return s.repo.UsePasskey(ctx, pending.MemberID, p.ID, counter, now)
	}

	return false, nil
}

// finishSecondFactor consumes the pending login after a right factor and starts the session.
func (s *Service) finishSecondFactor(ctx context.Context, tokenHash []byte, memberID int64, now time.Time) (Session, error) {
	deleted, err := s.repo.DeleteLoginChallenge(ctx, tokenHash)
	if err != nil {
		return Session{}, fmt.Errorf("delete pending login of member %d: %w", memberID, err)
	}

	if !deleted {
		return Session{}, ErrUnauthenticated
	}

	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return Session{}, fmt.Errorf("load member %d: %w", memberID, err)
	}

	if member.Disabled {
		return Session{}, ErrUnauthenticated
	}

	s.throttle.reset(member.Email)

	booksID, err := s.repo.LoginBooks(ctx, memberID)
	switch {
	case errors.Is(err, ErrNotFound):
		return Session{}, ErrUnauthenticated
	case err != nil:
		return Session{}, fmt.Errorf("load login books of member %d: %w", memberID, err)
	}

	return s.finishLogin(ctx, memberID, booksID, now)
}

// checkPassword counts against the login throttle of the member's email and runs argon2id in a hash slot.
func (s *Service) checkPassword(ctx context.Context, m domain.Member, plain string) error {
	if !s.throttle.attempt(m.Email, s.now()) {
		return ErrTooManyAttempts
	}

	if len(plain) > 4*domain.MaxPasswordLength {
		return ErrPasswordInvalid
	}

	ok, err := s.verify(ctx, plain, m.PasswordHash)
	if err != nil {
		return err
	}

	if !ok {
		return ErrPasswordInvalid
	}

	s.throttle.reset(m.Email)

	return nil
}
