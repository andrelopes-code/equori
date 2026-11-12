package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
)

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

// CompleteSecondFactor finishes a pending login with one answer. ErrSecondFactorInvalid is returned
// with the member of the pending login in Session.MemberID, for the log line.
func (s *Service) CompleteSecondFactor(
	ctx context.Context,
	loginToken, origin string,
	a SecondFactorAnswer,
) (SecondFactorLogin, error) {
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

	if a.TOTPCode != "" && s.box == nil {
		return result, ErrSecretKeyMissing
	}

	attempts, counted, err := s.repo.CountLoginAttempt(ctx, hash, now, secondFactorAttempts)
	if err != nil {
		return result, fmt.Errorf(
			"count second factor attempt of member %d: %w",
			pending.MemberID,
			err,
		)
	}

	if !counted {
		return result, ErrUnauthenticated
	}

	method, left, ok, err := s.useSecondFactor(ctx, pending, origin, a, now)
	if err != nil {
		return result, err
	}

	if !ok {
		return result, s.rejectSecondFactor(ctx, hash, pending.MemberID, attempts)
	}

	session, err := s.finishSecondFactor(ctx, hash, pending.MemberID, now)
	if err != nil {
		return result, err
	}

	return SecondFactorLogin{Session: session, Method: method, RecoveryCodesLeft: left}, nil
}

// rejectSecondFactor returns ErrSecondFactorInvalid; the last allowed attempt also deletes the pending login.
func (s *Service) rejectSecondFactor(
	ctx context.Context,
	hash []byte,
	memberID int64,
	attempts int32,
) error {
	if attempts >= secondFactorAttempts {
		if _, err := s.repo.DeleteLoginChallenge(ctx, hash); err != nil {
			return fmt.Errorf("delete pending login of member %d: %w", memberID, err)
		}
	}

	return ErrSecondFactorInvalid
}

// startPendingLogin stores a pending login of the member and returns its token and methods.
func (s *Service) startPendingLogin(
	ctx context.Context,
	memberID int64,
	origin string,
	now time.Time,
) (*PendingLogin, error) {
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

// useSecondFactor consumes the factor of the answer; ok is false for a refused value.
func (s *Service) useSecondFactor(
	ctx context.Context,
	pending domain.LoginChallenge,
	origin string,
	a SecondFactorAnswer,
	now time.Time,
) (method string, left int, ok bool, err error) {
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

// finishSecondFactor consumes the pending login after a right factor and starts the session.
func (s *Service) finishSecondFactor(
	ctx context.Context,
	tokenHash []byte,
	memberID int64,
	now time.Time,
) (Session, error) {
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
