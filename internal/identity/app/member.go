// Package app implements the identity use cases.
package app

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/identity/password"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Service) CreateMember(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.Member, error) {
	u, err := s.newMember(ctx, email, plain, role, l.Language)
	if err != nil {
		return domain.Member{}, err
	}

	if err := validateBooks(l.Region, base); err != nil {
		return domain.Member{}, err
	}

	created, _, err := s.repo.CreateMember(ctx, u, l.Region, base)

	return created, err
}

// IsAdmin reports whether a member has the role admin (ADR 025 F8).
func (s *Service) IsAdmin(ctx context.Context, memberID int64) (bool, error) {
	user, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return false, fmt.Errorf("load member %d: %w", memberID, err)
	}

	return user.Role == domain.RoleAdmin, nil
}

// SetDisplayName stores the trimmed name of the member; an empty name clears it. It returns the
// stored name, or a *domain.FieldError for an invalid one.
func (s *Service) SetDisplayName(ctx context.Context, memberID int64, name string) (string, error) {
	name, err := domain.NormalizeDisplayName(name)
	if err != nil {
		return "", err
	}

	if err := s.repo.SetDisplayName(ctx, memberID, name); err != nil {
		return "", fmt.Errorf("store display name of member %d: %w", memberID, err)
	}

	return name, nil
}

// newMember validates a new member and hashes its password.
func (s *Service) newMember(ctx context.Context, email, plain string, role domain.Role, language string) (domain.Member, error) {
	email, err := domain.NormalizeEmail(email)
	if err != nil {
		return domain.Member{}, err
	}

	if err := domain.ValidatePassword(plain); err != nil {
		return domain.Member{}, err
	}

	if !role.Valid() {
		return domain.Member{}, domain.ErrInvalidRole
	}

	if err := validateLanguage(language); err != nil {
		return domain.Member{}, err
	}

	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return domain.Member{}, err
	}

	hash := password.Hash(plain, s.cost)

	release()

	return domain.Member{Email: email, PasswordHash: hash, Role: role, Language: language}, nil
}
