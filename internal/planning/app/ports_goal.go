package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// GoalRepository stores the goals and what they hold; Repository embeds it.
type GoalRepository interface {
	// InsertGoal stores g with its accounts; a used name is a field error on name.
	InsertGoal(ctx context.Context, booksID int64, g domain.Goal) (domain.Goal, error)
	Goal(ctx context.Context, booksID int64, id uuid.UUID) (domain.Goal, error)
	ListGoals(
		ctx context.Context,
		booksID int64,
		p page.Request[IDKey],
	) ([]domain.Goal, *IDKey, error)
	// UpdateGoal replaces the fields and the accounts of g.ID; ErrNotFound when it is not the book's.
	UpdateGoal(ctx context.Context, booksID int64, g domain.Goal) (domain.Goal, error)
	// DeleteGoal removes the goal with its accounts; ErrNotFound when it is not the book's.
	DeleteGoal(ctx context.Context, booksID int64, id uuid.UUID) error
	// LinkGoalExpense stores that the goal pays the transaction, in place of the link the
	// transaction had (planning coherence A256).
	LinkGoalExpense(ctx context.Context, booksID int64, goalID, txID uuid.UUID) error
	// UnlinkGoalExpense deletes the link of the goal and the transaction; false without it.
	UnlinkGoalExpense(ctx context.Context, booksID int64, goalID, txID uuid.UUID) (bool, error)
	// GoalExpenseLinks returns every stored link of the book.
	GoalExpenseLinks(ctx context.Context, booksID int64) ([]GoalExpenseLink, error)
}

// GoalExpenseLink states that a goal pays a transaction (planning coherence A256).
type GoalExpenseLink struct{ GoalID, TransactionID uuid.UUID }
