package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
)

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
