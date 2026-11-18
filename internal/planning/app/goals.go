package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// GoalView is a goal with its progress today.
type GoalView struct {
	domain.Goal
	Progress domain.GoalProgress
	Prices   []Price
	Parts    []ValuedPart
	// Trailing is the return of the goal's accounts over the last 12 months; nil when there is
	// too little history or no flow (A124).
	Trailing *TrailingReturn
	// Spent sums the expense postings of the transactions the goal pays, in the base currency
	// (planning coherence A256).
	Spent money.Money
	// Withdrawal is nil when linked expenses cover the latest withdrawal, or the goal had none.
	Withdrawal *GoalWithdrawal
	// AllocatedAccounts holds the accounts the goal holds by allocations; OverAllocated is the
	// amount its allocations stand above the balance of those accounts, in the goal's currency,
	// nil at zero; SharedWith names the other goals that hold one of its accounts (A255).
	AllocatedAccounts []AllocatedAccount
	OverAllocated     *money.Money
	SharedWith        []uuid.UUID
}

// TrailingReturn is a return in basis points a year over a window of whole months.
type TrailingReturn struct {
	Months, BP int
}

// withReturn attaches the spent amount and the trailing return; a goal without a return reads as
// before.
func (s *Service) withReturn(ctx context.Context, booksID int64, v GoalView) (GoalView, error) {
	if err := s.withSpent(ctx, booksID, &v); err != nil {
		return v, err
	}

	return s.withTrailing(ctx, booksID, v)
}

func (s *Service) withTrailing(ctx context.Context, booksID int64, v GoalView) (GoalView, error) {
	// A yield of an allocated account belongs to no goal: the return reads the whole accounts.
	if len(v.AccountIDs) == 0 {
		return v, nil
	}

	bp, months, ok, err := s.returns.TrailingReturn(
		ctx,
		booksID,
		v.AccountIDs,
		s.clk.Today(ctx),
		v.Currency,
	)
	if err != nil || !ok {
		return v, err
	}

	v.Trailing = &TrailingReturn{Months: months, BP: bp}

	return v, nil
}

// GoalPatch holds the fields of a goal to change; nil fields stay as they are.
type GoalPatch struct {
	Name            *string
	Target          *money.Money
	DueOn           *time.Time
	AccountIDs      *[]uuid.UUID
	CountsAsSavings *bool
	// AllocatedAccountIDs replaces the accounts held by allocations (A255).
	AllocatedAccountIDs *[]uuid.UUID
}

// vetGoal validates g and measures it, so a goal that cannot be measured is never stored.
func (s *Service) vetGoal(ctx context.Context, booksID int64, g domain.Goal) (GoalView, error) {
	if err := g.Validate(); err != nil {
		return GoalView{}, err
	}

	if _, err := money.ParseCurrency(string(g.Currency)); err != nil {
		return GoalView{}, &domain.FieldError{
			Field:   "target.currency",
			Message: "must be a currency",
			Err:     domain.ErrValidation,
		}
	}

	if err := s.checkGoalAccounts(ctx, booksID, g); err != nil {
		return GoalView{}, err
	}

	return s.measure(ctx, booksID, g)
}

func (s *Service) CreateGoal(
	ctx context.Context,
	booksID int64,
	name string,
	target money.Money,
	dueOn time.Time,
	accounts, allocated []uuid.UUID,
	countsAsSavings bool,
) (GoalView, error) {
	g := domain.Goal{
		Name:                name,
		Target:              target.Amount(),
		Currency:            target.Currency(),
		DueOn:               dueOn,
		AccountIDs:          accounts,
		AllocatedAccountIDs: allocated,
		CountsAsSavings:     countsAsSavings,
	}

	view, err := s.vetGoal(ctx, booksID, g)
	if err != nil {
		return GoalView{}, err
	}

	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		view.Goal, err = repo.InsertGoal(ctx, booksID, g)

		return err
	})
	if err != nil {
		return GoalView{}, err
	}

	return s.withReturn(ctx, booksID, view)
}

func (s *Service) UpdateGoal(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	patch GoalPatch,
) (GoalView, error) {
	g, err := s.repo.Goal(ctx, booksID, id)
	if err != nil {
		return GoalView{}, err
	}

	if patch.Name != nil {
		g.Name = *patch.Name
	}

	if patch.Target != nil {
		g.Target, g.Currency = patch.Target.Amount(), patch.Target.Currency()
	}

	if patch.DueOn != nil {
		g.DueOn = *patch.DueOn
	}

	if patch.AccountIDs != nil {
		g.AccountIDs = *patch.AccountIDs
	}

	if patch.AllocatedAccountIDs != nil {
		g.AllocatedAccountIDs = *patch.AllocatedAccountIDs
	}

	if patch.CountsAsSavings != nil {
		g.CountsAsSavings = *patch.CountsAsSavings
	}

	view, err := s.vetGoal(ctx, booksID, g)
	if err != nil {
		return GoalView{}, err
	}

	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		view.Goal, err = repo.UpdateGoal(ctx, booksID, g)

		return err
	})
	if err != nil {
		return GoalView{}, err
	}

	return s.withReturn(ctx, booksID, view)
}

func (s *Service) DeleteGoal(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.InTx(
		ctx,
		func(repo Repository) error { return repo.DeleteGoal(ctx, booksID, id) },
	)
}

// measure sums the booked balances of the goal's accounts and their sub-accounts today, each
// instrument valued in the goal currency with stored prices (A55, P8 amendments A72 and A120).
func (s *Service) measure(ctx context.Context, booksID int64, g domain.Goal) (GoalView, error) {
	today := s.clk.Today(ctx)
	var current int64
	var prices []Price

	var parts []ValuedPart
	for _, id := range g.AccountIDs {
		v, err := s.ledger.ValuedBalance(ctx, booksID, id, today, g.Currency)
		if err != nil {
			return GoalView{}, err
		}

		current += v.Value.Amount()
		prices = append(prices, v.Prices...)
		parts = append(parts, v.Parts...)
	}

	view := GoalView{Goal: g, Prices: prices, Parts: parts}

	allocated, err := s.measureAllocated(ctx, booksID, &view, today)
	if err != nil {
		return GoalView{}, err
	}

	view.Progress = g.Measure(current + allocated)

	return view, nil
}

func (s *Service) Goal(ctx context.Context, booksID int64, id uuid.UUID) (GoalView, error) {
	g, err := s.repo.Goal(ctx, booksID, id)
	if err != nil {
		return GoalView{}, err
	}

	view, err := s.measure(ctx, booksID, g)
	if err != nil {
		return GoalView{}, err
	}

	return s.withReturn(ctx, booksID, view)
}

func (s *Service) ListGoals(
	ctx context.Context,
	booksID int64,
	p page.Request[IDKey],
) ([]GoalView, *IDKey, error) {
	gs, next, err := s.repo.ListGoals(ctx, booksID, p)
	if err != nil {
		return nil, nil, err
	}

	out := make([]GoalView, len(gs))
	views := make([]*GoalView, len(gs))

	for i, g := range gs {
		if out[i], err = s.measure(ctx, booksID, g); err != nil {
			return nil, nil, err
		}

		if out[i], err = s.withTrailing(ctx, booksID, out[i]); err != nil {
			return nil, nil, err
		}

		views[i] = &out[i]
	}

	return out, next, s.withSpent(ctx, booksID, views...)
}
