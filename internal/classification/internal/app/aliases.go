package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Service) ListAliases(ctx context.Context, userID int64, p page.Request[AliasKey]) ([]domain.Alias, *AliasKey, error) {
	return s.repo.ListAliases(ctx, userID, p)
}

func (s *Service) Alias(ctx context.Context, userID int64, id uuid.UUID) (domain.Alias, error) {
	return s.repo.Alias(ctx, userID, id)
}

func (s *Service) CreateAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error) {
	a, err := s.checkAlias(ctx, userID, a)
	if err != nil {
		return domain.Alias{}, err
	}
	return s.repo.InsertAlias(ctx, userID, a)
}

func (s *Service) ChangeAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error) {
	a, err := s.checkAlias(ctx, userID, a)
	if err != nil {
		return domain.Alias{}, err
	}
	return s.repo.UpdateAlias(ctx, userID, a)
}

func (s *Service) DeleteAlias(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.DeleteAlias(ctx, userID, id)
}

func (s *Service) checkAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error) {
	a, err := domain.NewAlias(a)
	if err != nil {
		return domain.Alias{}, err
	}
	missing, err := s.ledger.MissingPayees(ctx, userID, []uuid.UUID{a.PayeeID})
	if err != nil {
		return domain.Alias{}, err
	}
	if len(missing) > 0 {
		return domain.Alias{}, invalidRef("payee_id", "unknown payee")
	}
	return a, nil
}
