package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// EndBudget ends the budget from month on: the version of month and the later ones go, and an
// end takes their place; the months before keep their amounts (budget end E7).
func (s *Service) EndBudget(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	month time.Time,
) (domain.Budget, error) {
	month = domain.MonthOf(month)
	if err := s.checkEndMonth(ctx, month); err != nil {
		return domain.Budget{}, err
	}

	var out domain.Budget
	err := s.repo.InTx(ctx, func(repo Repository) error {
		b, err := repo.LockBudget(ctx, booksID, id)
		if err != nil {
			return err
		}

		ended, _, err := b.End(month)
		if err != nil {
			return err
		}

		if err := repo.DeleteBudgetAmountsFrom(ctx, booksID, id, month); err != nil {
			return err
		}

		if last := ended.Amounts[len(ended.Amounts)-1]; last.EffectiveFrom.Equal(month) {
			if err := repo.InsertBudgetAmount(ctx, booksID, id, last); err != nil {
				return err
			}
		}

		out, err = repo.Budget(ctx, booksID, id)

		return err
	})

	return out, err
}

// BudgetEndPreview returns what EndBudget would remove from the budget: the versions from month
// on and the balance a rollover budget would carry into month, zero when none (budget end E20).
func (s *Service) BudgetEndPreview(
	ctx context.Context,
	booksID int64,
	b domain.Budget,
	month time.Time,
) ([]domain.BudgetAmount, int64, error) {
	month = domain.MonthOf(month)
	if err := s.checkEndMonth(ctx, month); err != nil {
		return nil, 0, err
	}

	_, removed, err := b.End(month)
	if err != nil {
		return nil, 0, err
	}

	if !b.Rollover || !b.InForce(month) {
		return removed, 0, nil
	}

	p, _, err := s.BudgetProgress(ctx, booksID, b.ID, month)
	if err != nil {
		return nil, 0, err
	}

	return removed, max(p.Carried, 0), nil
}

// checkEndMonth keeps an end from the current month to the horizon: the months already lived
// keep their figures (budget end E7).
func (s *Service) checkEndMonth(ctx context.Context, month time.Time) error {
	if month.Before(domain.MonthOf(s.clk.Today(ctx))) || month.After(s.horizon(ctx)) {
		return &domain.FieldError{
			Field:   "month",
			Message: "must be from the current month to today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	return nil
}
