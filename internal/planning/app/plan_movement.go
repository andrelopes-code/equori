package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// Moves names the sets a schedule moves money between (planning coherence A253).
type Moves struct{ From, To AccountSet }

// movesMoney reports whether a schedule of kind moves money between two accounts of the book.
func movesMoney(kind domain.Kind) bool { return kind == domain.Savings || kind == domain.Transfer }

// ScheduleMoves returns the sets each savings and transfer schedule of schedules moves money
// between, by schedule id (A253).
func (s *Service) ScheduleMoves(
	ctx context.Context,
	booksID int64,
	schedules []domain.Schedule,
) (map[uuid.UUID]Moves, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	sets, err := s.accountSets(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]Moves)
	for _, sch := range schedules {
		if moves, ok := sets.moves(sch); ok {
			out[sch.ID] = moves
		}
	}

	return out, nil
}

// moves returns the sets of the account and of the counterpart of a savings or transfer
// schedule; false for another kind or an account outside the sets.
func (a accountSets) moves(sch domain.Schedule) (Moves, bool) {
	from, okFrom := a.of(sch.AccountID)
	to, okTo := a.of(sch.CounterpartID)

	// A schedule with a goal moves into the set that takes that goal's allocations (A253, A255).
	if set, ok := a.byGoal[sch.GoalID]; ok && okTo {
		to = set
	}

	return Moves{From: from, To: to}, movesMoney(sch.Kind) && okFrom && okTo
}

// addPlannedMovement adds amount to the savings and to the goal deposits of the plan by the sets
// the schedule moves between: into a set adds, out of it subtracts, inside it counts nothing. The
// brokerage figures hold the part whose counterpart is an account of kind brokerage (A253).
func addPlannedMovement(out *Plan, sets accountSets, sch domain.Schedule, amount int64) {
	moves, ok := sets.moves(sch)
	if !ok || moves.From == moves.To {
		return
	}

	brokerage := sets.facts[sch.CounterpartID].Kind == "brokerage"
	add := func(set AccountSet, total, part *int64) {
		signed := amount

		switch set {
		case moves.To:
		case moves.From:
			signed = -amount
		default:
			return
		}

		*total += signed
		if brokerage {
			*part += signed
		}
	}

	add(SetSavings, &out.Savings, &out.SavingsBrokerage)
	add(SetGoals, &out.GoalDeposits, &out.GoalDepositsBrokerage)
}
