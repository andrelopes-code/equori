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
	if month.Before(domain.MonthOf(s.clk.Today(ctx))) || month.After(s.horizon(ctx)) {
		return domain.Budget{}, &domain.FieldError{
			Field:   "month",
			Message: "must be from the current month to today + 12 months",
			Err:     domain.ErrValidation,
		}
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
