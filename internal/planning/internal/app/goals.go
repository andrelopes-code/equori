package app

import (
	"context"
	"errors"
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
}

func (s *Service) CreateGoal(ctx context.Context, userID int64, name string, target money.Money, dueOn time.Time, accounts []uuid.UUID) (GoalView, error) {
	g := domain.Goal{Name: name, Target: target.Amount(), Currency: target.Currency(), DueOn: dueOn, AccountIDs: accounts}
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
	for _, id := range accounts {
		a, ok := byID[id]
		if !ok || (a.Class != "asset" && a.Class != "liability") {
			return GoalView{}, &domain.FieldError{Field: "account_ids", Message: "must be balance accounts of the user", Err: domain.ErrValidation}
		}
	}
	today := s.clk.Today()
	for _, id := range accounts {
		if _, err := s.ledger.Balance(ctx, userID, id, today); errors.Is(err, ErrMixedInstruments) {
			return GoalView{}, &CurrencyError{Field: "account_ids"}
		} else if err != nil {
			return GoalView{}, err
		}
	}
	var created domain.Goal
	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		created, err = repo.InsertGoal(ctx, userID, g)
		return err
	})
	if err != nil {
		return GoalView{}, err
	}
	return s.measure(ctx, userID, created)
}

// measure sums the booked balances of the goal's accounts today, each valued in the
// goal currency with stored prices (A55, P8 amendment A72).
func (s *Service) measure(ctx context.Context, userID int64, g domain.Goal) (GoalView, error) {
	today := s.clk.Today()
	var current int64
	var prices []Price
	for _, id := range g.AccountIDs {
		b, err := s.ledger.Balance(ctx, userID, id, today)
		if err != nil {
			return GoalView{}, err
		}
		if b.IsZero() {
			continue
		}
		if b.Currency() != g.Currency {
			var used []Price
			if b, used, err = s.prices.Convert(ctx, b, g.Currency, today); err != nil {
				return GoalView{}, err
			}
			prices = append(prices, used...)
		}
		current += b.Amount()
	}
	return GoalView{Goal: g, Progress: g.Measure(current), Prices: prices}, nil
}

func (s *Service) Goal(ctx context.Context, userID int64, id uuid.UUID) (GoalView, error) {
	g, err := s.repo.Goal(ctx, userID, id)
	if err != nil {
		return GoalView{}, err
	}
	return s.measure(ctx, userID, g)
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
	}
	return out, next, nil
}
