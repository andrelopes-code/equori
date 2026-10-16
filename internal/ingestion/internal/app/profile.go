package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func (s *Service) Profile(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Profile, error) {
	return s.repo.Profile(ctx, userID, accountID)
}

// SaveProfile replaces the account's CSV profile; an account of another user is ErrNotFound.
func (s *Service) SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error) {
	p, err := domain.NewProfile(p)
	if err != nil {
		return domain.Profile{}, err
	}
	return s.repo.SaveProfile(ctx, p)
}
