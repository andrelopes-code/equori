package app

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/charset"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func (s *Service) Profile(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Profile, error) {
	return s.repo.Profile(ctx, booksID, accountID)
}

// SaveProfile replaces the account's CSV profile; an account of another book is ErrNotFound.
func (s *Service) SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error) {
	p, err := domain.NewProfile(p)
	if err != nil {
		return domain.Profile{}, err
	}

	if !slices.Contains(charset.Names(), p.Encoding) {
		return domain.Profile{}, &domain.FieldError{Field: "encoding", Message: "must be one of " + strings.Join(charset.Names(), ", ")}
	}

	return s.repo.SaveProfile(ctx, p)
}
