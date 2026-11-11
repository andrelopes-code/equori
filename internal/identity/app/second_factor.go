package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/domain"
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
	// CountLoginAttempt counts one answer before it is checked; ok is false when the pending login is
	// unknown, expired or has used limit attempts.
	CountLoginAttempt(ctx context.Context, tokenHash []byte, now time.Time, limit int32) (attempts int32, ok bool, err error)
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

func (s *Service) useRecoveryCode(ctx context.Context, memberID int64, code string) (int, bool, error) {
	hash, ok := domain.HashRecoveryCode(code)
	if !ok {
		return 0, false, nil
	}

	return s.repo.UseRecoveryCode(ctx, memberID, hash)
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
