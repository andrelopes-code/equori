package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

var _ app.Repository = (*Repository)(nil)

type Repository struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool, q: New(pool)} }

func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{q: New(tx)} }

// Replace deletes the rows of accountIDs and inserts r; it runs in the dispatcher's transaction.
func (r *Repository) Replace(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	rb domain.Rebuilt,
) error {
	if err := r.q.DeletePositionDays(
		ctx,
		DeletePositionDaysParams{BooksID: booksID, AccountIds: accountIDs},
	); err != nil {
		return err
	}

	if err := r.q.DeleteRealizedResults(
		ctx,
		DeleteRealizedResultsParams{BooksID: booksID, AccountIds: accountIDs},
	); err != nil {
		return err
	}

	if err := r.q.DeleteIncomeEvents(
		ctx,
		DeleteIncomeEventsParams{BooksID: booksID, AccountIds: accountIDs},
	); err != nil {
		return err
	}

	return r.insertRebuilt(ctx, booksID, rb)
}

func (r *Repository) insertRebuilt(
	ctx context.Context,
	booksID int64,
	rb domain.Rebuilt,
) error {
	if err := r.insertRebuiltDays(ctx, booksID, rb); err != nil {
		return err
	}

	if err := r.insertRebuiltResults(ctx, booksID, rb); err != nil {
		return err
	}

	return r.insertRebuiltIncomes(ctx, booksID, rb)
}

func (r *Repository) insertRebuiltDays(
	ctx context.Context,
	booksID int64,
	rb domain.Rebuilt,
) error {
	for _, d := range rb.Days {
		if err := r.q.InsertPositionDay(ctx, InsertPositionDayParams{
			BooksID:    booksID,
			AccountID:  d.AccountID,
			Instrument: string(d.Instrument),
			Date:       d.Date,
			Quantity:   d.Quantity,
			CostBasis:  d.CostBasis,
		}); err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) insertRebuiltResults(
	ctx context.Context,
	booksID int64,
	rb domain.Rebuilt,
) error {
	for _, x := range rb.Results {
		if err := r.q.InsertRealizedResult(ctx, InsertRealizedResultParams{
			BooksID:       booksID,
			TransactionID: x.TransactionID,
			AccountID:     x.AccountID,
			Instrument:    string(x.Instrument),
			Date:          x.Date,
			Month:         x.Month,
			Quantity:      x.Quantity,
			Cost:          x.Cost,
			Proceeds:      x.Proceeds,
			Result:        x.Result,
			Kind:          x.Kind,
			TaxClass:      optional(x.TaxClass),
			Currency:      string(x.Currency),
		}); err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) insertRebuiltIncomes(
	ctx context.Context,
	booksID int64,
	rb domain.Rebuilt,
) error {
	for _, e := range rb.Incomes {
		if err := r.q.InsertIncomeEvent(ctx, InsertIncomeEventParams{
			BooksID:       booksID,
			TransactionID: e.TransactionID,
			AccountID:     e.AccountID,
			Instrument:    string(e.Instrument),
			Date:          e.Date,
			IncomeType:    e.Type,
			TaxTreatment:  optional(e.TaxTreatment),
			Gross:         e.Gross,
			Withheld:      e.Withheld,
			Currency:      string(e.Currency),
		}); err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) PositionsAt(
	ctx context.Context,
	booksID int64,
	date time.Time,
) ([]domain.PositionDay, error) {
	rows, err := r.q.PositionsAt(ctx, PositionsAtParams{BooksID: booksID, OnDate: date})

	out := make([]domain.PositionDay, len(rows))
	for i, row := range rows {
		out[i] = domain.PositionDay{
			AccountID:  row.AccountID,
			Instrument: money.Currency(row.Instrument),
			Date:       row.Date,
			Quantity:   row.Quantity,
			CostBasis:  row.CostBasis,
		}
	}

	return out, err
}

func (r *Repository) RealizedResults(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) ([]domain.RealizedResult, error) {
	rows, err := r.q.ListRealizedResults(
		ctx,
		ListRealizedResultsParams{BooksID: booksID, FromDate: from, ToDate: to},
	)

	out := make([]domain.RealizedResult, len(rows))
	for i, row := range rows {
		out[i] = domain.RealizedResult{
			TransactionID: row.TransactionID,
			AccountID:     row.AccountID,
			Instrument:    money.Currency(row.Instrument),
			Date:          row.Date,
			Month:         row.Month,
			Quantity:      row.Quantity,
			Cost:          row.Cost,
			Proceeds:      row.Proceeds,
			Result:        row.Result,
			Kind:          row.Kind,
			TaxClass:      deref(row.TaxClass),
			Currency:      money.Currency(row.Currency),
		}
	}

	return out, err
}

func (r *Repository) IncomeEvents(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) ([]domain.IncomeEvent, error) {
	rows, err := r.q.ListIncomeEvents(
		ctx,
		ListIncomeEventsParams{BooksID: booksID, FromDate: from, ToDate: to},
	)

	out := make([]domain.IncomeEvent, len(rows))
	for i, row := range rows {
		out[i] = domain.IncomeEvent{
			TransactionID: row.TransactionID,
			AccountID:     row.AccountID,
			Instrument:    money.Currency(row.Instrument),
			Date:          row.Date,
			Type:          row.IncomeType,
			TaxTreatment:  deref(row.TaxTreatment),
			Gross:         row.Gross,
			Withheld:      row.Withheld,
			Currency:      money.Currency(row.Currency),
		}
	}

	return out, err
}

func (r *Repository) BooksToRebuild(ctx context.Context) ([]int64, error) {
	return r.q.ListRebuildBooks(ctx)
}

func (r *Repository) ClaimRebuildVersion(ctx context.Context, version string) (bool, error) {
	n, err := r.q.ClaimRebuildVersion(ctx, version)
	if err != nil {
		return false, fmt.Errorf("claim rebuild version: %w", err)
	}

	return n == 1, nil
}

func (r *Repository) ForgetRebuildVersion(ctx context.Context) error {
	if err := r.q.ForgetRebuildVersion(ctx); err != nil {
		return fmt.Errorf("forget rebuild version: %w", err)
	}

	return nil
}

// optional stores the empty string as NULL.
func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}
