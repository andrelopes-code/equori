package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// realize marks the occurrence realized by the transaction and, for a schedule with a goal,
// allocates to that goal what the transaction put into the schedule's counterpart, on the
// transaction's date. One occurrence holds at most one allocation (planning coherence A255).
func (s *Service) realize(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch domain.Schedule,
	occurrenceID, txID uuid.UUID,
	by string,
) (domain.Occurrence, error) {
	realized, err := repo.Realize(ctx, booksID, occurrenceID, txID, by)
	if err != nil || sch.GoalID == uuid.Nil {
		return realized, err
	}

	g, err := repo.Goal(ctx, booksID, sch.GoalID)
	if errors.Is(err, ErrNotFound) || !slices.Contains(g.AllocatedAccountIDs, sch.CounterpartID) {
		return realized, nil
	}

	if err != nil {
		return realized, err
	}

	txs, err := s.ledger.TransactionFacts(ctx, booksID, []uuid.UUID{txID})
	if err != nil || len(txs) == 0 {
		return realized, err
	}

	amount, _ := txs[0].On(sch.CounterpartID)
	if amount == 0 {
		return realized, nil
	}

	return realized, repo.SetOccurrenceAllocation(ctx, booksID, domain.Allocation{
		GoalID:       sch.GoalID,
		AccountID:    sch.CounterpartID,
		BookedOn:     txs[0].Date,
		Amount:       amount,
		OccurrenceID: occurrenceID,
	})
}

// release makes a realized occurrence expected again and deletes the allocation it created.
func release(
	ctx context.Context,
	repo Repository,
	booksID int64,
	occurrenceID uuid.UUID,
	decline bool,
) (domain.Occurrence, error) {
	released, err := repo.Release(ctx, booksID, occurrenceID, decline)
	if err != nil {
		return released, err
	}

	return released, repo.DeleteOccurrenceAllocation(ctx, booksID, occurrenceID)
}
