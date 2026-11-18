package postgres

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) InsertGoal(
	ctx context.Context,
	booksID int64,
	g domain.Goal,
) (domain.Goal, error) {
	row, err := r.q.InsertGoal(
		ctx,
		InsertGoalParams{
			BooksID:         booksID,
			Name:            g.Name,
			Target:          g.Target,
			Currency:        string(g.Currency),
			DueOn:           g.DueOn,
			CountsAsSavings: g.CountsAsSavings,
		},
	)
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Goal{}, &domain.FieldError{
			Field:   "name",
			Message: "is the name of another goal",
			Err:     domain.ErrValidation,
		}
	}

	if err != nil {
		return domain.Goal{}, fmt.Errorf("insert goal: %w", err)
	}

	g.ID = row.ID
	if err := r.upsertGoalAccounts(ctx, booksID, g); err != nil {
		return domain.Goal{}, err
	}

	return r.oneGoal(ctx, row, nil)
}

// upsertGoalAccounts stores the whole and the allocated links of g; an account that is whole now
// loses the allocations it had (planning coherence A255).
func (r *Repository) upsertGoalAccounts(ctx context.Context, booksID int64, g domain.Goal) error {
	for allocated, ids := range map[bool][]uuid.UUID{false: g.AccountIDs, true: g.AllocatedAccountIDs} {
		err := r.q.UpsertGoalAccounts(ctx, UpsertGoalAccountsParams{
			BooksID: booksID, GoalID: g.ID, AccountIds: ids, Allocated: allocated,
		})
		if err != nil {
			return fmt.Errorf("upsert goal accounts: %w", err)
		}
	}

	err := r.q.DeleteAllocationsOfAccounts(ctx, DeleteAllocationsOfAccountsParams{
		BooksID: booksID, GoalID: g.ID, AccountIds: g.AccountIDs,
	})
	if err != nil {
		return fmt.Errorf("delete allocations of whole accounts: %w", err)
	}

	return nil
}

func (r *Repository) UpdateGoal(
	ctx context.Context,
	booksID int64,
	g domain.Goal,
) (domain.Goal, error) {
	row, err := r.q.UpdateGoal(
		ctx,
		UpdateGoalParams{
			BooksID:         booksID,
			ID:              g.ID,
			Name:            g.Name,
			Target:          g.Target,
			Currency:        string(g.Currency),
			DueOn:           g.DueOn,
			CountsAsSavings: g.CountsAsSavings,
		},
	)
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Goal{}, &domain.FieldError{
			Field:   "name",
			Message: "is the name of another goal",
			Err:     domain.ErrValidation,
		}
	}

	if err != nil {
		return r.oneGoal(ctx, row, err)
	}

	// The links the goal keeps stay in place: deleting one would delete its allocations (A255).
	err = r.q.DeleteGoalAccountsExcept(ctx, DeleteGoalAccountsExceptParams{
		BooksID: booksID, GoalID: g.ID, Keep: slices.Concat(g.AccountIDs, g.AllocatedAccountIDs),
	})
	if err != nil {
		return domain.Goal{}, fmt.Errorf("delete goal accounts: %w", err)
	}

	if err := r.upsertGoalAccounts(ctx, booksID, g); err != nil {
		return domain.Goal{}, err
	}

	return r.oneGoal(ctx, row, nil)
}

func (r *Repository) DeleteGoal(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteGoal(ctx, DeleteGoalParams{BooksID: booksID, ID: id})
	if err != nil {
		return fmt.Errorf("delete goal: %w", err)
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) completeGoals(
	ctx context.Context,
	rows []PlanningGoal,
) ([]domain.Goal, error) {
	if len(rows) == 0 {
		return nil, nil
	}

	ids := make([]uuid.UUID, len(rows))
	out := make([]domain.Goal, len(rows))

	byID := make(map[uuid.UUID]*domain.Goal, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = domain.Goal{
			ID:              row.ID,
			Name:            row.Name,
			Target:          row.Target,
			Currency:        money.Currency(row.Currency),
			DueOn:           row.DueOn,
			CountsAsSavings: row.CountsAsSavings,
		}
		byID[row.ID] = &out[i]
	}

	accounts, err := r.q.ListGoalAccounts(
		ctx,
		ListGoalAccountsParams{BooksID: rows[0].BooksID, GoalIds: ids},
	)
	if err != nil {
		return nil, fmt.Errorf("list goal accounts: %w", err)
	}

	for _, a := range accounts {
		g := byID[a.GoalID]
		if a.Allocated {
			g.AllocatedAccountIDs = append(g.AllocatedAccountIDs, a.AccountID)
		} else {
			g.AccountIDs = append(g.AccountIDs, a.AccountID)
		}
	}

	return out, nil
}

func (r *Repository) oneGoal(
	ctx context.Context,
	row PlanningGoal,
	err error,
) (domain.Goal, error) {
	if err != nil {
		return domain.Goal{}, notFound(err)
	}

	out, err := r.completeGoals(ctx, []PlanningGoal{row})
	if err != nil {
		return domain.Goal{}, err
	}

	return out[0], nil
}

func (r *Repository) Goal(ctx context.Context, booksID int64, id uuid.UUID) (domain.Goal, error) {
	row, err := r.q.GetGoal(ctx, GetGoalParams{BooksID: booksID, ID: id})
	return r.oneGoal(ctx, row, err)
}

func (r *Repository) ListGoals(
	ctx context.Context,
	booksID int64,
	p page.Request[app.IDKey],
) ([]domain.Goal, *app.IDKey, error) {
	after, limit := keyset(p)

	rows, err := r.q.ListGoals(
		ctx,
		ListGoalsParams{BooksID: booksID, AfterID: after, RowLimit: limit},
	)
	if err != nil {
		return nil, nil, fmt.Errorf("list goals: %w", err)
	}

	rows, next := trim(rows, p.Limit, func(g PlanningGoal) uuid.UUID { return g.ID })
	out, err := r.completeGoals(ctx, rows)

	return out, next, err
}
