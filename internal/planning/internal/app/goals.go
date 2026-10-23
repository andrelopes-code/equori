package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
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
}

// TrailingReturn is a return in basis points a year over a window of whole months.
type TrailingReturn struct {
	Months, BP int
}

// withReturn attaches the trailing return; a goal without one reads as before.
func (s *Service) withReturn(ctx context.Context, userID int64, v GoalView) (GoalView, error) {
	bp, months, ok, err := s.returns.TrailingReturn(ctx, userID, v.AccountIDs, s.clk.Today(), v.Currency)
	if err != nil || !ok {
		return v, err
	}
	v.Trailing = &TrailingReturn{Months: months, BP: bp}
	return v, nil
}

// GoalPatch holds the fields of a goal to change; nil fields stay as they are.
type GoalPatch struct {
	Name       *string
	Target     *money.Money
	DueOn      *time.Time
	AccountIDs *[]uuid.UUID
}

// vetGoal validates g and measures it, so a goal that cannot be measured is never stored.
func (s *Service) vetGoal(ctx context.Context, userID int64, g domain.Goal) (GoalView, error) {
	if err := g.Validate(); err != nil {
		return GoalView{}, err
	}
	if _, err := money.ParseCurrency(string(g.Currency)); err != nil {
		return GoalView{}, &domain.FieldError{Field: "target.currency", Message: "must be a currency", Err: domain.ErrValidation}
	}
	facts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return GoalView{}, err
	}
	byID := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		byID[a.ID] = a
	}
	for _, id := range g.AccountIDs {
		a, ok := byID[id]
		if !ok || (a.Class != "asset" && a.Class != "liability") {
			return GoalView{}, &domain.FieldError{Field: "account_ids", Message: "must be balance accounts of the user", Err: domain.ErrValidation}
		}
	}
	for _, id := range g.AccountIDs {
		for parent := byID[id].ParentID; parent != uuid.Nil; parent = byID[parent].ParentID {
			if slices.Contains(g.AccountIDs, parent) {
				return GoalView{}, &domain.FieldError{Field: "account_ids", Message: "must not hold an account and one of its sub-accounts", Err: domain.ErrValidation}
			}
		}
	}
	return s.measure(ctx, userID, g)
}

func (s *Service) CreateGoal(ctx context.Context, userID int64, name string, target money.Money, dueOn time.Time, accounts []uuid.UUID) (GoalView, error) {
	g := domain.Goal{Name: name, Target: target.Amount(), Currency: target.Currency(), DueOn: dueOn, AccountIDs: accounts}
	view, err := s.vetGoal(ctx, userID, g)
	if err != nil {
		return GoalView{}, err
	}
	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		view.Goal, err = repo.InsertGoal(ctx, userID, g)
		return err
	})
	if err != nil {
		return GoalView{}, err
	}
	return s.withReturn(ctx, userID, view)
}

func (s *Service) UpdateGoal(ctx context.Context, userID int64, id uuid.UUID, patch GoalPatch) (GoalView, error) {
	g, err := s.repo.Goal(ctx, userID, id)
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
	view, err := s.vetGoal(ctx, userID, g)
	if err != nil {
		return GoalView{}, err
	}
	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		view.Goal, err = repo.UpdateGoal(ctx, userID, g)
		return err
	})
	if err != nil {
		return GoalView{}, err
	}
	return s.withReturn(ctx, userID, view)
}

func (s *Service) DeleteGoal(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.InTx(ctx, func(repo Repository) error { return repo.DeleteGoal(ctx, userID, id) })
}

// measure sums the booked balances of the goal's accounts and their sub-accounts today, each
// instrument valued in the goal currency with stored prices (A55, P8 amendments A72 and A120).
func (s *Service) measure(ctx context.Context, userID int64, g domain.Goal) (GoalView, error) {
	today := s.clk.Today()
	var current int64
	var prices []Price
	var parts []ValuedPart
	for _, id := range g.AccountIDs {
		v, err := s.ledger.ValuedBalance(ctx, userID, id, today, g.Currency)
		if err != nil {
			return GoalView{}, err
		}
		current += v.Value.Amount()
		prices = append(prices, v.Prices...)
		parts = append(parts, v.Parts...)
	}
	return GoalView{Goal: g, Progress: g.Measure(current), Prices: prices, Parts: parts}, nil
}

func (s *Service) Goal(ctx context.Context, userID int64, id uuid.UUID) (GoalView, error) {
	g, err := s.repo.Goal(ctx, userID, id)
	if err != nil {
		return GoalView{}, err
	}
	view, err := s.measure(ctx, userID, g)
	if err != nil {
		return GoalView{}, err
	}
	return s.withReturn(ctx, userID, view)
}

func (s *Service) ListGoals(ctx context.Context, userID int64, p page.Request[IDKey]) ([]GoalView, *IDKey, error) {
	gs, next, err := s.repo.ListGoals(ctx, userID, p)
	if err != nil {
		return nil, nil, err
	}
	out := make([]GoalView, len(gs))
	for i, g := range gs {
		if out[i], err = s.measure(ctx, userID, g); err != nil {
			return nil, nil, err
		}
		if out[i], err = s.withReturn(ctx, userID, out[i]); err != nil {
			return nil, nil, err
		}
	}
	return out, next, nil
}
