package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/domain"
)

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
