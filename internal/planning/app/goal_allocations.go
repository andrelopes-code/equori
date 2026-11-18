package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AllocatedAccount is an account a goal holds by allocations: what the goal has allocated in it
// and what the account still has available for any goal, both in the account's currency
// (planning coherence A255).
type AllocatedAccount struct {
	AccountID            uuid.UUID
	Allocated, Available money.Money
}

// AllocationView is an allocation with the currency of its account.
type AllocationView struct {
	domain.Allocation
	Currency money.Currency
}

// allocationTotals sums the allocations booked on or before a date by account and by goal and
// account.
type allocationTotals struct {
	byAccount map[uuid.UUID]int64
	byGoal    map[[2]uuid.UUID]int64
}

func (s *Service) allocationTotals(
	ctx context.Context,
	repo Repository,
	booksID int64,
	until time.Time,
) (allocationTotals, error) {
	all, err := repo.Allocations(ctx, booksID)
	if err != nil {
		return allocationTotals{}, err
	}

	out := allocationTotals{
		byAccount: make(map[uuid.UUID]int64),
		byGoal:    make(map[[2]uuid.UUID]int64),
	}

	for _, a := range all {
		if a.BookedOn.After(until) {
			continue
		}

		out.byAccount[a.AccountID] += a.Amount
		out.byGoal[[2]uuid.UUID{a.GoalID, a.AccountID}] += a.Amount
	}

	return out, nil
}

// measureAllocated sets the allocated accounts and the over-allocated amount of v and returns
// what the goal has allocated, valued in its currency at today's prices (A255, C2).
func (s *Service) measureAllocated(
	ctx context.Context,
	booksID int64,
	v *GoalView,
	today time.Time,
) (int64, error) {
	if len(v.AllocatedAccountIDs) == 0 {
		return 0, nil
	}

	totals, err := s.allocationTotals(ctx, s.repo, booksID, today)
	if err != nil {
		return 0, err
	}

	var current, over int64

	for _, id := range v.AllocatedAccountIDs {
		balance, err := s.ledger.Balance(ctx, booksID, id, today)
		if err != nil {
			return 0, err
		}

		allocated, err := money.New(totals.byGoal[[2]uuid.UUID{v.ID, id}], balance.Currency())
		if err != nil {
			return 0, err
		}

		available, err := money.New(balance.Amount()-totals.byAccount[id], balance.Currency())
		if err != nil {
			return 0, err
		}

		v.AllocatedAccounts = append(
			v.AllocatedAccounts,
			AllocatedAccount{AccountID: id, Allocated: allocated, Available: available},
		)

		value, missing, err := s.allocatedValue(ctx, v, allocated, available, today)
		if err != nil {
			return 0, err
		}

		current, over = current+value, over+missing
	}

	if over > 0 {
		m, err := money.New(over, v.Currency)
		if err != nil {
			return 0, err
		}

		v.OverAllocated = &m
	}

	return current, nil
}

// allocatedValue values in the goal's currency what the goal has allocated in an account and
// what the account lacks when its allocations stand above its balance.
func (s *Service) allocatedValue(
	ctx context.Context,
	v *GoalView,
	allocated, available money.Money,
	today time.Time,
) (value, missing int64, err error) {
	if value, err = s.inGoalCurrency(ctx, v, allocated, today); err != nil {
		return 0, 0, err
	}

	if available.Amount() >= 0 {
		return value, 0, nil
	}

	lacking, err := s.inGoalCurrency(ctx, v, available, today)

	return value, -lacking, err
}

// inGoalCurrency values m in the currency of the goal and records the prices used.
func (s *Service) inGoalCurrency(
	ctx context.Context,
	v *GoalView,
	m money.Money,
	today time.Time,
) (int64, error) {
	if m.Currency() == v.Currency {
		return m.Amount(), nil
	}

	value, used, err := s.prices.Convert(ctx, m, v.Currency, today)
	if err != nil {
		return 0, err
	}

	v.Prices = append(v.Prices, used...)

	return value.Amount(), nil
}

// CreateGoalAllocation assigns a signed amount of an allocated account to the goal on a date,
// today when nil, and returns the goal. The amount is in the currency of the account, at most
// what the account has available, and never brings the goal's allocation below zero (A255).
func (s *Service) CreateGoalAllocation(
	ctx context.Context,
	booksID int64,
	goalID, accountID uuid.UUID,
	amount money.Money,
	bookedOn *time.Time,
) (GoalView, error) {
	today := s.clk.Today(ctx)

	on := today
	if bookedOn != nil {
		on = *bookedOn
	}

	err := s.repo.InTx(ctx, func(repo Repository) error {
		g, err := repo.Goal(ctx, booksID, goalID)
		if err != nil {
			return err
		}

		if !slices.Contains(g.AllocatedAccountIDs, accountID) {
			return allocationError("account_id", "must be an account the goal holds by allocations")
		}

		if err := s.checkAllocation(
			ctx,
			repo,
			booksID,
			g.ID,
			accountID,
			amount,
			today,
		); err != nil {
			return err
		}

		_, err = repo.InsertGoalAllocation(ctx, booksID, domain.Allocation{
			GoalID: goalID, AccountID: accountID, BookedOn: on, Amount: amount.Amount(),
		})

		return err
	})
	if err != nil {
		return GoalView{}, err
	}

	return s.Goal(ctx, booksID, goalID)
}

// checkAllocation validates the amount of a new allocation against the account and the goal.
func (s *Service) checkAllocation(
	ctx context.Context,
	repo Repository,
	booksID int64,
	goalID, accountID uuid.UUID,
	amount money.Money,
	today time.Time,
) error {
	balance, err := s.ledger.Balance(ctx, booksID, accountID, today)
	if err != nil {
		return err
	}

	if amount.Currency() != balance.Currency() {
		return allocationError("amount.currency", "must be the currency of the account")
	}

	// A date far ahead counts every allocation: a future one already reserves its amount.
	totals, err := s.allocationTotals(ctx, repo, booksID, allTime[1])
	if err != nil {
		return err
	}

	switch {
	case amount.Amount() == 0:
		return allocationError("amount", "must not be zero")
	case amount.Amount() > balance.Amount()-totals.byAccount[accountID]:
		return allocationError("amount", "is above what the account has available")
	case totals.byGoal[[2]uuid.UUID{goalID, accountID}]+amount.Amount() < 0:
		return allocationError("amount", "releases more than the goal has allocated in the account")
	}

	return nil
}

// GoalAllocations returns the allocations of the goal, the latest first.
func (s *Service) GoalAllocations(
	ctx context.Context,
	booksID int64,
	goalID uuid.UUID,
) ([]AllocationView, error) {
	if _, err := s.repo.Goal(ctx, booksID, goalID); err != nil {
		return nil, err
	}

	all, err := s.repo.Allocations(ctx, booksID)
	if err != nil {
		return nil, err
	}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	currency := make(map[uuid.UUID]money.Currency, len(facts))
	for _, a := range facts {
		currency[a.ID] = a.Instrument
	}

	out := []AllocationView{}
	for _, a := range all {
		if a.GoalID == goalID {
			out = append(out, AllocationView{Allocation: a, Currency: currency[a.AccountID]})
		}
	}

	return out, nil
}

// DeleteGoalAllocation deletes an allocation of the goal. One an occurrence created is deleted
// by unrealizing the occurrence, and one whose removal brings the goal's allocation in the
// account below zero stays (A255).
func (s *Service) DeleteGoalAllocation(
	ctx context.Context,
	booksID int64,
	goalID, id uuid.UUID,
) error {
	return s.repo.InTx(ctx, func(repo Repository) error {
		a, err := repo.GoalAllocation(ctx, booksID, goalID, id)
		if err != nil {
			return err
		}

		if a.OccurrenceID != uuid.Nil {
			return allocationError("allocation_id", "was created by an occurrence: unrealize it")
		}

		totals, err := s.allocationTotals(ctx, repo, booksID, allTime[1])
		if err != nil {
			return err
		}

		if totals.byGoal[[2]uuid.UUID{goalID, a.AccountID}]-a.Amount < 0 {
			return allocationError(
				"allocation_id",
				"leaves the goal with less than it released from the account",
			)
		}

		return repo.DeleteGoalAllocation(ctx, booksID, goalID, id)
	})
}

func allocationError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}
