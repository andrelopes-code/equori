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

	// InsertGoalAllocation stores an allocation and returns it with its id (planning coherence
	// A255).
	InsertGoalAllocation(
		ctx context.Context,
		booksID int64,
		a domain.Allocation,
	) (domain.Allocation, error)
	// GoalAllocation returns an allocation of the goal; ErrNotFound when it is not the goal's.
	GoalAllocation(
		ctx context.Context,
		booksID int64,
		goalID, id uuid.UUID,
	) (domain.Allocation, error)
	DeleteGoalAllocation(ctx context.Context, booksID int64, goalID, id uuid.UUID) error
	// Allocations returns every allocation of the book, the latest first.
	Allocations(ctx context.Context, booksID int64) ([]domain.Allocation, error)
	// SetOccurrenceAllocation stores the allocation an occurrence creates, in place of the one
	// it had.
	SetOccurrenceAllocation(ctx context.Context, booksID int64, a domain.Allocation) error
	DeleteOccurrenceAllocation(ctx context.Context, booksID int64, occurrenceID uuid.UUID) error
}

// GoalExpenseLink states that a goal pays a transaction (planning coherence A256).
type GoalExpenseLink struct{ GoalID, TransactionID uuid.UUID }
