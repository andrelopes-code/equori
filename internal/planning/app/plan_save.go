package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// PlanAmount is the amount a plan save sets on a category from its month on.
type PlanAmount struct {
	CategoryID uuid.UUID
	Amount     money.Money
}

// SaveBudgetPlan stores the reference choice and sets each listed category's amount from month
// on, in one transaction (A130): the version of month is replaced, a category without a budget
// gets one when its amount is above zero, and versions of other months stay.
// fixed is read only with SourceFixed. targetBP is the savings target in basis points; nil
// clears it (A187).
func (s *Service) SaveBudgetPlan(
	ctx context.Context,
	booksID int64,
	month time.Time,
	source domain.ReferenceSource,
	fixed *money.Money,
	targetBP *int,
	amounts []PlanAmount,
) (Plan, error) {
	month = domain.MonthOf(month)
	if month.Before(domain.MonthOf(s.clk.Today(ctx))) || month.After(s.horizon(ctx)) {
		return Plan{}, &domain.FieldError{Field: "month", Message: "must be from the current month to today + 12 months", Err: domain.ErrValidation}
	}

	if targetBP != nil && (*targetBP < 0 || *targetBP > basisPoints) {
		return Plan{}, &domain.FieldError{Field: "savings_target_bp", Message: "must be from 0 to 10000", Err: domain.ErrValidation}
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	ref := domain.Reference{Source: source}
	if targetBP != nil {
		ref.TargetBP, ref.HasTarget = *targetBP, true
	}

	if source == domain.SourceFixed {
		if fixed == nil {
			return Plan{}, &domain.FieldError{Field: "fixed", Message: "is required with the fixed source", Err: domain.ErrValidation}
		}

		if err := checkBudgetAmount(*fixed, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = "fixed" + strings.TrimPrefix(fe.Field, "amount")
			}

			return Plan{}, err
		}

		ref.Fixed, ref.HasFixed = fixed.Amount(), true
	}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	byID := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		byID[a.ID] = a
	}

	stored, err := s.repo.Budgets(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	budgeted := make(map[uuid.UUID]bool, len(stored))
	for _, b := range stored {
		budgeted[b.CategoryID] = true
	}

	seen := make(map[uuid.UUID]bool, len(amounts))
	for i, a := range amounts {
		prefix := fmt.Sprintf("amounts[%d].", i)
		// A closed category keeps its row in the plan while it has a budget.
		if c, ok := byID[a.CategoryID]; !ok || c.Class != "expense" || (c.Closed && !budgeted[a.CategoryID]) {
			return Plan{}, &domain.FieldError{Field: prefix + "category_id", Message: "must be an expense category of the book, open or with a budget", Err: domain.ErrValidation}
		}

		if seen[a.CategoryID] {
			return Plan{}, &domain.FieldError{Field: prefix + "category_id", Message: "is listed twice", Err: domain.ErrValidation}
		}

		seen[a.CategoryID] = true
		if err := checkBudgetAmount(a.Amount, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = prefix + fe.Field
			}

			return Plan{}, err
		}
	}

	err = s.repo.InTx(ctx, func(repo Repository) error {
		budgets, err := repo.Budgets(ctx, booksID)
		if err != nil {
			return err
		}

		byCategory := make(map[uuid.UUID]uuid.UUID, len(budgets))
		for _, b := range budgets {
			byCategory[b.CategoryID] = b.ID
		}

		for _, a := range amounts {
			version := domain.BudgetAmount{EffectiveFrom: month, Amount: a.Amount.Amount()}

			id, ok := byCategory[a.CategoryID]
			if !ok {
				if version.Amount == 0 {
					continue
				}

				b := domain.Budget{CategoryID: a.CategoryID, Currency: base, Amounts: []domain.BudgetAmount{version}}
				if _, err := repo.InsertBudget(ctx, booksID, b); err != nil {
					return err
				}

				continue
			}

			if _, err := repo.LockBudget(ctx, booksID, id); err != nil {
				return err
			}

			if err := repo.UpsertBudgetAmount(ctx, booksID, id, version); err != nil {
				return err
			}
		}

		return repo.SaveBudgetReference(ctx, booksID, ref, base)
	})
	if err != nil {
		return Plan{}, err
	}

	return s.BudgetPlan(ctx, booksID, month)
}
