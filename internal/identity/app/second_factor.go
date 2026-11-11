package app

import (
	"context"
	"errors"
	"fmt"
	"time"

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
