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
// gets one when its amount is above zero, a budget out of force in month resumes only above
// zero (budget end E10), and versions of other months stay.
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
	if err := s.checkPlanArguments(ctx, month, targetBP); err != nil {
		return Plan{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	ref, err := buildReference(source, fixed, targetBP, base)
	if err != nil {
		return Plan{}, err
	}

	if err := s.keepBucketTarget(ctx, booksID, month, &ref); err != nil {
		return Plan{}, err
	}

	if err := s.checkPlanAmounts(ctx, booksID, amounts, base); err != nil {
		return Plan{}, err
	}

	if err := s.persistPlan(ctx, booksID, month, ref, base, amounts); err != nil {
		return Plan{}, err
	}

	return s.BudgetPlan(ctx, booksID, month)
}

// checkPlanArguments validates the month and the savings target of a plan save.
func (s *Service) checkPlanArguments(ctx context.Context, month time.Time, targetBP *int) error {
	if month.Before(domain.MonthOf(s.clk.Today(ctx))) || month.After(s.horizon(ctx)) {
		return &domain.FieldError{
			Field:   "month",
			Message: "must be from the current month to today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	if targetBP != nil && (*targetBP < 0 || *targetBP > basisPoints) {
		return &domain.FieldError{
			Field:   "savings_target_bp",
			Message: "must be from 0 to 10000",
			Err:     domain.ErrValidation,
		}
	}

	return nil
}

// buildReference returns the reference choice of a plan save; fixed is read only with
// SourceFixed.
func buildReference(
	source domain.ReferenceSource,
	fixed *money.Money,
	targetBP *int,
	base money.Currency,
) (domain.Reference, error) {
	ref := domain.Reference{Source: source}
	if targetBP != nil {
		ref.TargetBP, ref.HasTarget = *targetBP, true
	}

	if source == domain.SourceFixed {
		if fixed == nil {
			return domain.Reference{}, &domain.FieldError{
				Field:   "fixed",
				Message: "is required with the fixed source",
				Err:     domain.ErrValidation,
			}
		}

		if err := checkBudgetAmount(*fixed, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = "fixed" + strings.TrimPrefix(fe.Field, "amount")
			}

			return domain.Reference{}, err
		}

		ref.Fixed, ref.HasFixed = fixed.Amount(), true
	}

	return ref, nil
}

// checkPlanAmounts validates each listed category and amount of a plan save.
func (s *Service) checkPlanAmounts(
	ctx context.Context,
	booksID int64,
	amounts []PlanAmount,
	base money.Currency,
) error {
	byID, budgeted, err := s.planCategories(ctx, booksID)
	if err != nil {
		return err
	}

	seen := make(map[uuid.UUID]bool, len(amounts))
	for i, a := range amounts {
		prefix := fmt.Sprintf("amounts[%d].", i)
		// A closed category keeps its row in the plan while it has a budget.
		if c, ok := byID[a.CategoryID]; !ok || c.Class != "expense" ||
			(c.Closed && !budgeted[a.CategoryID]) {
			return &domain.FieldError{
				Field:   prefix + "category_id",
				Message: "must be an expense category of the book, open or with a budget",
				Err:     domain.ErrValidation,
			}
		}

		if seen[a.CategoryID] {
			return &domain.FieldError{
				Field:   prefix + "category_id",
				Message: "is listed twice",
				Err:     domain.ErrValidation,
			}
		}

		seen[a.CategoryID] = true
		if err := checkBudgetAmount(a.Amount, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = prefix + fe.Field
			}

			return err
		}
	}

	return nil
}

// planCategories returns the accounts of the book by id and the categories that have a budget.
func (s *Service) planCategories(
	ctx context.Context,
	booksID int64,
) (map[uuid.UUID]Account, map[uuid.UUID]bool, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, nil, err
	}

	byID := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		byID[a.ID] = a
	}

	stored, err := s.repo.Budgets(ctx, booksID)
	if err != nil {
		return nil, nil, err
	}

	budgeted := make(map[uuid.UUID]bool, len(stored))
	for _, b := range stored {
		budgeted[b.CategoryID] = true
	}

	return byID, budgeted, nil
}

// persistPlan sets the amounts and the reference in one transaction.
func (s *Service) persistPlan(
	ctx context.Context,
	booksID int64,
	month time.Time,
	ref domain.Reference,
	base money.Currency,
	amounts []PlanAmount,
) error {
	return s.repo.InTx(ctx, func(repo Repository) error {
		budgets, err := repo.Budgets(ctx, booksID)
		if err != nil {
			return err
		}

		byCategory := make(map[uuid.UUID]domain.Budget, len(budgets))
		for _, b := range budgets {
			byCategory[b.CategoryID] = b
		}

		for _, a := range amounts {
			version := domain.BudgetAmount{EffectiveFrom: month, Amount: a.Amount.Amount()}

			b, ok := byCategory[a.CategoryID]
			// A zero on a budget out of force in month adds nothing (budget end E10).
			if ok && version.Amount == 0 && !b.InForce(month) {
				continue
			}

			id := b.ID
			if !ok {
				if version.Amount == 0 {
					continue
				}

				b := domain.Budget{
					CategoryID: a.CategoryID,
					Currency:   base,
					Amounts:    []domain.BudgetAmount{version},
				}
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
}
