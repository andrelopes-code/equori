package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
)

func (r *Repository) InsertGoalAllocation(
	ctx context.Context,
	booksID int64,
	a domain.Allocation,
) (domain.Allocation, error) {
	row, err := r.q.InsertGoalAllocation(ctx, InsertGoalAllocationParams{
		BooksID:   booksID,
		GoalID:    a.GoalID,
		AccountID: a.AccountID,
		BookedOn:  a.BookedOn,
		Amount:    a.Amount,
	})
	if err != nil {
		return domain.Allocation{}, fmt.Errorf("insert goal allocation: %w", err)
	}

	return toAllocation(row), nil
}

func (r *Repository) GoalAllocation(
	ctx context.Context,
	booksID int64,
	goalID, id uuid.UUID,
) (domain.Allocation, error) {
	row, err := r.q.GetGoalAllocation(
		ctx,
		GetGoalAllocationParams{BooksID: booksID, GoalID: goalID, ID: id},
	)
	if err != nil {
		return domain.Allocation{}, notFound(err)
	}

	return toAllocation(row), nil
}

func (r *Repository) DeleteGoalAllocation(
	ctx context.Context,
	booksID int64,
	goalID, id uuid.UUID,
) error {
	n, err := r.q.DeleteGoalAllocation(
		ctx,
		DeleteGoalAllocationParams{BooksID: booksID, GoalID: goalID, ID: id},
	)
	if err != nil {
		return fmt.Errorf("delete goal allocation: %w", err)
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) Allocations(ctx context.Context, booksID int64) ([]domain.Allocation, error) {
	rows, err := r.q.ListAllocations(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list goal allocations: %w", err)
	}

	out := make([]domain.Allocation, len(rows))
	for i, row := range rows {
		out[i] = toAllocation(row)
	}

	return out, nil
}

func (r *Repository) SetOccurrenceAllocation(
	ctx context.Context,
	booksID int64,
	a domain.Allocation,
) error {
	err := r.q.UpsertOccurrenceAllocation(ctx, UpsertOccurrenceAllocationParams{
		BooksID:      booksID,
		GoalID:       a.GoalID,
		AccountID:    a.AccountID,
		BookedOn:     a.BookedOn,
		Amount:       a.Amount,
		OccurrenceID: a.OccurrenceID,
	})
	if err != nil {
		return fmt.Errorf("set occurrence allocation: %w", err)
	}

	return nil
}

func (r *Repository) DeleteOccurrenceAllocation(
	ctx context.Context,
	booksID int64,
	occurrenceID uuid.UUID,
) error {
	err := r.q.DeleteOccurrenceAllocation(
		ctx,
		DeleteOccurrenceAllocationParams{BooksID: booksID, OccurrenceID: occurrenceID},
	)
	if err != nil {
		return fmt.Errorf("delete occurrence allocation: %w", err)
	}

	return nil
}

func toAllocation(row PlanningGoalAllocation) domain.Allocation {
	return domain.Allocation{
		ID:           row.ID,
		GoalID:       row.GoalID,
		AccountID:    row.AccountID,
		BookedOn:     row.BookedOn,
		Amount:       row.Amount,
		OccurrenceID: row.OccurrenceID.UUID,
	}
}
