package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Service) ListAliases(ctx context.Context, booksID int64, p page.Request[AliasKey]) ([]domain.Alias, *AliasKey, error) {
	return s.repo.ListAliases(ctx, booksID, p)
}

func (s *Service) Alias(ctx context.Context, booksID int64, id uuid.UUID) (domain.Alias, error) {
	return s.repo.Alias(ctx, booksID, id)
}

func (s *Service) CreateAlias(ctx context.Context, booksID int64, a domain.Alias) (domain.Alias, error) {
	a, err := s.checkAlias(ctx, booksID, a)
	if err != nil {
		return domain.Alias{}, err
	}

	return s.repo.InsertAlias(ctx, booksID, a)
}

func (s *Service) ChangeAlias(ctx context.Context, booksID int64, a domain.Alias) (domain.Alias, error) {
	a, err := s.checkAlias(ctx, booksID, a)
	if err != nil {
		return domain.Alias{}, err
	}

	return s.repo.UpdateAlias(ctx, booksID, a)
}

func (s *Service) DeleteAlias(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.DeleteAlias(ctx, booksID, id)
}

func (s *Service) checkAlias(ctx context.Context, booksID int64, a domain.Alias) (domain.Alias, error) {
	a, err := domain.NewAlias(a)
	if err != nil {
		return domain.Alias{}, err
	}

	missing, err := s.ledger.MissingPayees(ctx, booksID, []uuid.UUID{a.PayeeID})
	if err != nil {
		return domain.Alias{}, err
	}

	if len(missing) > 0 {
		return domain.Alias{}, invalidRef("payee_id", "unknown payee")
	}

	return a, nil
}
