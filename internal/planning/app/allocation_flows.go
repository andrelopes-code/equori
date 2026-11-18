package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// allocationMove is an allocation on a base-currency account read as a movement between sets:
// from the set of its account into the set that takes its goal. goals and savings hold what each
// set gains, negative for the set the amount leaves; an origin in the spending set subtracts
// from no set, and a movement inside one set is not listed (planning coherence A255).
type allocationMove struct {
	alloc          domain.Allocation
	goal           string
	goals, savings int64
}

// gain returns what the movement adds to set.
func (m allocationMove) gain(set AccountSet) int64 {
	if set == SetGoals {
		return m.goals
	}

	return m.savings
}

// allocationMoves returns the movements of the allocations booked in [from, to).
func (s *Service) allocationMoves(
	ctx context.Context,
	booksID int64,
	sets accountSets,
	base money.Currency,
	from, to time.Time,
) ([]allocationMove, error) {
	all, err := s.repo.Allocations(ctx, booksID)
	if err != nil {
		return nil, err
	}

	var out []allocationMove

	for _, a := range all {
		origin, ok := sets.of(a.AccountID)
		dest := sets.byGoal[a.GoalID]

		if a.BookedOn.Before(from) || !a.BookedOn.Before(to) || !ok || origin == dest ||
			sets.facts[a.AccountID].Instrument != base {
			continue
		}

		m := allocationMove{alloc: a, goal: sets.names[a.GoalID]}
		for _, side := range []struct {
			set  AccountSet
			sign int64
		}{{dest, 1}, {origin, -1}} {
			switch side.set {
			case SetGoals:
				m.goals += side.sign * a.Amount
			case SetSavings:
				m.savings += side.sign * a.Amount
			case SetSpending:
			}
		}

		out = append(out, m)
	}

	return out, nil
}

// setFlows returns, by first day of month in [from, to), what went into the goal set or the
// savings set and what left it: the movements of A251 over its accounts and the allocations of
// A255.
func (s *Service) setFlows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	sets accountSets,
	set AccountSet,
	from, to time.Time,
) (map[time.Time]flow, error) {
	held := sets.savings
	if set == SetGoals {
		held = sets.goals
	}

	out, err := s.inflows(ctx, booksID, facts, base, held, from, to)
	if err != nil {
		return nil, err
	}

	moves, err := s.allocationMoves(ctx, booksID, sets, base, from, to)
	if err != nil {
		return nil, err
	}

	for _, m := range moves {
		if gain := m.gain(set); gain != 0 {
			month := domain.MonthOf(m.alloc.BookedOn)
			out[month] = out[month].add(gain)
		}
	}

	return out, nil
}
