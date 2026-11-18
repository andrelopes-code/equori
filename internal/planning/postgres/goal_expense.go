package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
)

func (r *Repository) LinkGoalExpense(
	ctx context.Context,
	booksID int64,
	goalID, txID uuid.UUID,
) error {
	err := r.q.UpsertGoalExpense(
		ctx,
		UpsertGoalExpenseParams{BooksID: booksID, TransactionID: txID, GoalID: goalID},
	)
	if err != nil {
		return fmt.Errorf("link goal expense: %w", err)
	}

	return nil
}

func (r *Repository) UnlinkGoalExpense(
	ctx context.Context,
	booksID int64,
	goalID, txID uuid.UUID,
) (bool, error) {
	n, err := r.q.DeleteGoalExpense(
		ctx,
		DeleteGoalExpenseParams{BooksID: booksID, GoalID: goalID, TransactionID: txID},
	)
	if err != nil {
		return false, fmt.Errorf("unlink goal expense: %w", err)
	}

	return n > 0, nil
}

func (r *Repository) GoalExpenseLinks(
	ctx context.Context,
	booksID int64,
) ([]app.GoalExpenseLink, error) {
	rows, err := r.q.ListGoalExpenses(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list goal expenses: %w", err)
	}

	out := make([]app.GoalExpenseLink, len(rows))
	for i, row := range rows {
		out[i] = app.GoalExpenseLink{GoalID: row.GoalID, TransactionID: row.TransactionID}
	}

	return out, nil
}
