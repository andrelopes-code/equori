package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) InsertBudget(
	ctx context.Context,
	booksID int64,
	b domain.Budget,
) (domain.Budget, error) {
	row, err := r.q.InsertBudget(
		ctx,
		InsertBudgetParams{
			BooksID:           booksID,
			CategoryAccountID: b.CategoryID,
			Rollover:          b.Rollover,
			Currency:          string(b.Currency),
		},
	)
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Budget{}, app.ErrBudgetExists
	}

	if err != nil {
		return domain.Budget{}, fmt.Errorf("insert budget: %w", err)
	}

	for _, a := range b.Amounts {
		if err := r.InsertBudgetAmount(ctx, booksID, row.ID, a); err != nil {
			return domain.Budget{}, err
		}
	}

	return r.oneBudget(ctx, row, nil)
}

func (r *Repository) InsertBudgetAmount(
	ctx context.Context,
	booksID int64,
	budgetID uuid.UUID,
	a domain.BudgetAmount,
) error {
	err := r.q.InsertBudgetAmount(
		ctx,
		InsertBudgetAmountParams{
			BooksID:       booksID,
			BudgetID:      budgetID,
			EffectiveFrom: a.EffectiveFrom,
			Amount:        a.Amount,
		},
	)
	if err != nil {
		return fmt.Errorf("insert budget amount: %w", err)
	}

	return nil
}

func (r *Repository) completeBudgets(
	ctx context.Context,
	rows []PlanningBudget,
) ([]domain.Budget, error) {
	if len(rows) == 0 {
		return nil, nil
	}

	ids := make([]uuid.UUID, len(rows))
	out := make([]domain.Budget, len(rows))

	byID := make(map[uuid.UUID]*domain.Budget, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = domain.Budget{
			ID:         row.ID,
			CategoryID: row.CategoryAccountID,
			Rollover:   row.Rollover,
			Currency:   money.Currency(row.Currency),
		}
		byID[row.ID] = &out[i]
	}

	amounts, err := r.q.ListBudgetAmounts(
		ctx,
		ListBudgetAmountsParams{BooksID: rows[0].BooksID, BudgetIds: ids},
	)
	if err != nil {
		return nil, fmt.Errorf("list budget amounts: %w", err)
	}

	for _, a := range amounts {
		b := byID[a.BudgetID]
		b.Amounts = append(
			b.Amounts,
			domain.BudgetAmount{EffectiveFrom: a.EffectiveFrom, Amount: a.Amount},
		)
	}

	return out, nil
}

func (r *Repository) oneBudget(
	ctx context.Context,
	row PlanningBudget,
	err error,
) (domain.Budget, error) {
	if err != nil {
		return domain.Budget{}, notFound(err)
	}

	out, err := r.completeBudgets(ctx, []PlanningBudget{row})
	if err != nil {
		return domain.Budget{}, err
	}

	return out[0], nil
}

func (r *Repository) Budget(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Budget, error) {
	row, err := r.q.GetBudget(ctx, GetBudgetParams{BooksID: booksID, ID: id})
	return r.oneBudget(ctx, row, err)
}

func (r *Repository) DeleteBudget(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteBudget(ctx, DeleteBudgetParams{BooksID: booksID, ID: id})
	if err != nil {
		return fmt.Errorf("delete budget: %w", err)
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) LockBudget(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Budget, error) {
	row, err := r.q.LockBudget(ctx, LockBudgetParams{BooksID: booksID, ID: id})
	return r.oneBudget(ctx, row, err)
}

func (r *Repository) ListBudgets(
	ctx context.Context,
	booksID int64,
	p page.Request[app.IDKey],
) ([]domain.Budget, *app.IDKey, error) {
	after, limit := keyset(p)

	rows, err := r.q.ListBudgets(
		ctx,
		ListBudgetsParams{BooksID: booksID, AfterID: after, RowLimit: limit},
	)
	if err != nil {
		return nil, nil, fmt.Errorf("list budgets: %w", err)
	}

	rows, next := trim(rows, p.Limit, func(b PlanningBudget) uuid.UUID { return b.ID })
	out, err := r.completeBudgets(ctx, rows)

	return out, next, err
}

func (r *Repository) Budgets(ctx context.Context, booksID int64) ([]domain.Budget, error) {
	rows, err := r.q.ListAllBudgets(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list all budgets: %w", err)
	}

	return r.completeBudgets(ctx, rows)
}

func (r *Repository) UpsertBudgetAmount(
	ctx context.Context,
	booksID int64,
	budgetID uuid.UUID,
	a domain.BudgetAmount,
) error {
	err := r.q.UpsertBudgetAmount(
		ctx,
		UpsertBudgetAmountParams{
			BooksID:       booksID,
			BudgetID:      budgetID,
			EffectiveFrom: a.EffectiveFrom,
			Amount:        a.Amount,
		},
	)
	if err != nil {
		return fmt.Errorf("upsert budget amount: %w", err)
	}

	return nil
}

func (r *Repository) BudgetReference(
	ctx context.Context,
	booksID int64,
) (domain.Reference, bool, error) {
	row, err := r.q.GetBudgetReference(ctx, booksID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Reference{}, false, nil
	}

	if err != nil {
		return domain.Reference{}, false, fmt.Errorf("get budget reference: %w", err)
	}

	out := domain.Reference{Source: domain.ReferenceSource(row.Source)}
	if row.Amount != nil {
		out.Fixed, out.HasFixed = *row.Amount, true
	}

	if row.SavingsTargetBp != nil {
		out.TargetBP, out.HasTarget = int(*row.SavingsTargetBp), true
	}

	return out, true, nil
}

func (r *Repository) SaveBudgetReference(
	ctx context.Context,
	booksID int64,
	ref domain.Reference,
	currency money.Currency,
) error {
	var amount *int64
	if ref.HasFixed {
		amount = &ref.Fixed
	}

	var target *int32
	if ref.HasTarget {
		bp := int32(ref.TargetBP) //nolint:gosec // SaveBudgetPlan keeps it within 0 to 10000
		target = &bp
	}

	err := r.q.UpsertBudgetReference(ctx, UpsertBudgetReferenceParams{
		BooksID:         booksID,
		Source:          string(ref.Source),
		Amount:          amount,
		Currency:        string(currency),
		SavingsTargetBp: target,
	})
	if err != nil {
		return fmt.Errorf("save budget reference: %w", err)
	}

	return nil
}
