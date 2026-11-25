package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// ProjectionPlan returns the plan of the member; false means the member has none.
func (r *Repository) ProjectionPlan(
	ctx context.Context,
	booksID, memberID int64,
) (app.ProjectionView, bool, error) {
	head, err := r.q.GetProjectionPlan(
		ctx,
		GetProjectionPlanParams{BooksID: booksID, MemberID: memberID},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ProjectionView{}, false, nil
	}

	if err != nil {
		return app.ProjectionView{}, false, fmt.Errorf("get projection plan: %w", err)
	}

	changes, err := r.q.ListProjectionChanges(
		ctx,
		ListProjectionChangesParams{BooksID: booksID, MemberID: memberID},
	)
	if err != nil {
		return app.ProjectionView{}, false, fmt.Errorf("list projection changes: %w", err)
	}

	v := app.ProjectionView{
		Projection: domain.Projection{
			WithdrawalAge: int(head.WithdrawalAge),
			LastAge:       int(head.LastAge),
			RealReturnBP:  int(head.RealReturnBp),
			InflationBP:   int(head.InflationBp),
			Mode:          head.WithdrawalMode,
			Income:        orZero(head.Income),
			RateBP:        int(orZero(head.WithdrawalRateBp)),
			Changes:       make([]domain.ProjectionChange, len(changes)),

			WithdrawalReturnBP: convertPtr[int](head.WithdrawalReturnBp),
			CautiousReturnBP:   convertPtr[int](head.CautiousReturnBp),
			FavorableReturnBP:  convertPtr[int](head.FavorableReturnBp),
			GainTaxBP:          convertPtr[int](head.GainTaxBp),
		},
		Currency:      money.Currency(head.Currency),
		BaselineDate:  head.BaselineDate,
		BaselineValue: head.BaselineValue,
	}
	for i, c := range changes {
		v.Changes[i] = domain.ProjectionChange{Month: c.Month, Amount: c.Amount}
	}

	return v, true, nil
}

// SaveProjectionPlan stores the plan and replaces its changes dated on or after from; on a pool
// it runs in one transaction.
func (r *Repository) SaveProjectionPlan(
	ctx context.Context,
	booksID, memberID int64,
	v app.ProjectionView,
	from time.Time,
) error {
	if r.pool == nil {
		return saveProjectionPlan(ctx, r.q, booksID, memberID, v, from)
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		return saveProjectionPlan(ctx, New(tx), booksID, memberID, v, from)
	})
}

// DeleteProjectionPlan removes the plan; its changes go with it by cascade.
func (r *Repository) DeleteProjectionPlan(
	ctx context.Context,
	booksID, memberID int64,
) (bool, error) {
	n, err := r.q.DeleteProjectionPlan(
		ctx,
		DeleteProjectionPlanParams{BooksID: booksID, MemberID: memberID},
	)
	if err != nil {
		return false, fmt.Errorf("delete projection plan: %w", err)
	}

	return n > 0, nil
}

func saveProjectionPlan(
	ctx context.Context,
	q *Queries,
	booksID, memberID int64,
	v app.ProjectionView,
	from time.Time,
) error {
	if err := q.UpsertProjectionPlan(ctx, projectionHead(booksID, memberID, v)); err != nil {
		return fmt.Errorf("upsert projection plan: %w", err)
	}

	err := q.DeleteProjectionChangesFrom(ctx, DeleteProjectionChangesFromParams{
		BooksID:  booksID,
		MemberID: memberID,
		Month:    from,
	})
	if err != nil {
		return fmt.Errorf("delete projection changes: %w", err)
	}

	for _, c := range v.Changes {
		if c.Month.Before(from) {
			continue
		}

		err := q.InsertProjectionChange(ctx, InsertProjectionChangeParams{
			BooksID:  booksID,
			MemberID: memberID,
			Month:    c.Month,
			Amount:   c.Amount,
		})
		if err != nil {
			return fmt.Errorf("insert projection change: %w", err)
		}
	}

	return nil
}

func projectionHead(booksID, memberID int64, v app.ProjectionView) UpsertProjectionPlanParams {
	//nolint:gosec // G115: Projection.Validate bounds the ages and the rates to int16 and int32
	head := UpsertProjectionPlanParams{
		BooksID:        booksID,
		MemberID:       memberID,
		WithdrawalAge:  int16(v.WithdrawalAge),
		LastAge:        int16(v.LastAge),
		RealReturnBp:   int32(v.RealReturnBP),
		InflationBp:    int32(v.InflationBP),
		WithdrawalMode: v.Mode,
		Currency:       string(v.Currency),
		BaselineDate:   v.BaselineDate,
		BaselineValue:  v.BaselineValue,

		WithdrawalReturnBp: convertPtr[int32](v.WithdrawalReturnBP),
		CautiousReturnBp:   convertPtr[int32](v.CautiousReturnBP),
		FavorableReturnBp:  convertPtr[int32](v.FavorableReturnBP),
		GainTaxBp:          convertPtr[int32](v.GainTaxBP),
	}

	if v.Mode == domain.ModeIncome {
		head.Income = &v.Income

		return head
	}

	//nolint:gosec // G115: Projection.Validate bounds the rate to 1-2000
	rate := int32(v.RateBP)
	head.WithdrawalRateBp = &rate

	return head
}

// convertPtr converts between the widths of a nullable integer.
func convertPtr[T, F ~int | ~int32](v *F) *T {
	if v == nil {
		return nil
	}

	//nolint:gosec // G115: the database and Projection.Validate bound every value to int32
	out := T(*v)

	return &out
}

func orZero[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}

	return *p
}
