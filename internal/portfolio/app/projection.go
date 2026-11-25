package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

var (
	ErrProjectionInvalid    = domain.ErrProjectionInvalid
	ErrProjectionPastChange = errors.New("a past contribution change cannot be altered")
)

// ProjectionView is the plan of a member with the currency and the baseline set by its first
// save (PJ3).
type ProjectionView struct {
	domain.Projection

	Currency      money.Currency
	BaselineDate  time.Time
	BaselineValue int64 // minor units of Currency
}

// Projection returns the plan of the member; ErrNotFound when the member has none (PJ5).
func (s *Service) Projection(
	ctx context.Context,
	booksID, memberID int64,
) (ProjectionView, error) {
	v, ok, err := s.repo.ProjectionPlan(ctx, booksID, memberID)
	if err != nil {
		return ProjectionView{}, fmt.Errorf("read the projection plan: %w", err)
	}

	if !ok {
		return ProjectionView{}, ErrNotFound
	}

	return v, nil
}

// SaveProjection creates or replaces the plan of the member under PJ3 and PJ4.
func (s *Service) SaveProjection(
	ctx context.Context,
	booksID, memberID int64,
	p domain.Projection,
) (ProjectionView, error) {
	p.Incomes = orderedIncomes(p.Incomes)

	if err := p.Validate(); err != nil {
		return ProjectionView{}, err
	}

	p.Changes = slices.SortedFunc(slices.Values(p.Changes), func(a, b domain.ProjectionChange) int {
		return a.Month.Compare(b.Month)
	})

	v, ok, err := s.repo.ProjectionPlan(ctx, booksID, memberID)
	if err != nil {
		return ProjectionView{}, fmt.Errorf("read the projection plan: %w", err)
	}

	today := s.ledger.Today(ctx)
	// a first save has no stored change to keep: every change of the body is stored
	var from time.Time

	if ok {
		from = time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
		if !domain.KeepsPast(v.Changes, p.Changes, from) {
			return ProjectionView{}, ErrProjectionPastChange
		}
	} else if v, err = s.projectionBaseline(ctx, booksID, today); err != nil {
		return ProjectionView{}, err
	}

	v.Projection = p

	if err := s.repo.SaveProjectionPlan(ctx, booksID, memberID, v, from); err != nil {
		return ProjectionView{}, fmt.Errorf("save the projection plan: %w", err)
	}

	// The stored plan is the answer: of two first saves at once, the baseline of the first holds.
	return s.Projection(ctx, booksID, memberID)
}

// orderedIncomes returns the incomes by start age with their names trimmed (PJ8).
func orderedIncomes(incomes []domain.ProjectionIncome) []domain.ProjectionIncome {
	out := slices.Clone(incomes)
	for i := range out {
		out[i].Name = strings.TrimSpace(out[i].Name)
	}

	slices.SortStableFunc(out, func(a, b domain.ProjectionIncome) int {
		return a.StartAge - b.StartAge
	})

	return out
}

// DeleteProjection removes the plan of the member with its changes; ErrNotFound without one.
func (s *Service) DeleteProjection(ctx context.Context, booksID, memberID int64) error {
	ok, err := s.repo.DeleteProjectionPlan(ctx, booksID, memberID)
	if err != nil {
		return fmt.Errorf("delete the projection plan: %w", err)
	}

	if !ok {
		return ErrNotFound
	}

	return nil
}

// projectionBaseline is the currency and the value of every brokerage tree on today (PJ3).
func (s *Service) projectionBaseline(
	ctx context.Context,
	booksID int64,
	today time.Time,
) (ProjectionView, error) {
	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return ProjectionView{}, err
	}

	roots, err := s.brokerageRoots(ctx, booksID)
	if err != nil {
		return ProjectionView{}, err
	}

	total, err := s.valued(ctx, booksID, roots, today, base)
	if err != nil {
		return ProjectionView{}, err
	}

	return ProjectionView{Currency: base, BaselineDate: today, BaselineValue: total.Amount()}, nil
}
