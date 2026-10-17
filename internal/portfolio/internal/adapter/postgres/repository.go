package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

var _ app.Repository = (*Repository)(nil)

type Repository struct {
	q *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{q: New(pool)} }

func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{q: New(tx)} }

// Replace deletes the rows of accountIDs and inserts r; it runs in the dispatcher's transaction.
func (r *Repository) Replace(ctx context.Context, userID int64, accountIDs []uuid.UUID, rb domain.Rebuilt) error {
	if err := r.q.DeletePositionDays(ctx, DeletePositionDaysParams{UserID: userID, AccountIds: accountIDs}); err != nil {
		return err
	}
	if err := r.q.DeleteRealizedResults(ctx, DeleteRealizedResultsParams{UserID: userID, AccountIds: accountIDs}); err != nil {
		return err
	}
	if err := r.q.DeleteIncomeEvents(ctx, DeleteIncomeEventsParams{UserID: userID, AccountIds: accountIDs}); err != nil {
		return err
	}
	for _, d := range rb.Days {
		if err := r.q.InsertPositionDay(ctx, InsertPositionDayParams{
			UserID: userID, AccountID: d.AccountID, Instrument: string(d.Instrument), Date: d.Date, Quantity: d.Quantity, CostBasis: d.CostBasis,
		}); err != nil {
			return err
		}
	}
	for _, x := range rb.Results {
		if err := r.q.InsertRealizedResult(ctx, InsertRealizedResultParams{
			UserID: userID, TransactionID: x.TransactionID, AccountID: x.AccountID, Instrument: string(x.Instrument), Date: x.Date, Month: x.Month,
			Quantity: x.Quantity, Cost: x.Cost, Proceeds: x.Proceeds, Result: x.Result, TaxClass: x.TaxClass, Currency: string(x.Currency),
		}); err != nil {
			return err
		}
	}
	for _, e := range rb.Incomes {
		if err := r.q.InsertIncomeEvent(ctx, InsertIncomeEventParams{
			UserID: userID, TransactionID: e.TransactionID, AccountID: e.AccountID, Instrument: string(e.Instrument), Date: e.Date,
			IncomeType: e.Type, TaxTreatment: e.TaxTreatment, Gross: e.Gross, Withheld: e.Withheld, Currency: string(e.Currency),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) PositionsAt(ctx context.Context, userID int64, date time.Time) ([]domain.PositionDay, error) {
	rows, err := r.q.PositionsAt(ctx, PositionsAtParams{UserID: userID, OnDate: date})
	out := make([]domain.PositionDay, len(rows))
	for i, row := range rows {
		out[i] = domain.PositionDay{AccountID: row.AccountID, Instrument: money.Currency(row.Instrument), Date: row.Date, Quantity: row.Quantity, CostBasis: row.CostBasis}
	}
	return out, err
}

func (r *Repository) RealizedResults(ctx context.Context, userID int64, from, to time.Time) ([]domain.RealizedResult, error) {
	rows, err := r.q.ListRealizedResults(ctx, ListRealizedResultsParams{UserID: userID, FromDate: from, ToDate: to})
	out := make([]domain.RealizedResult, len(rows))
	for i, row := range rows {
		out[i] = domain.RealizedResult{
			TransactionID: row.TransactionID, AccountID: row.AccountID, Instrument: money.Currency(row.Instrument), Date: row.Date, Month: row.Month,
			Quantity: row.Quantity, Cost: row.Cost, Proceeds: row.Proceeds, Result: row.Result, TaxClass: row.TaxClass, Currency: money.Currency(row.Currency),
		}
	}
	return out, err
}

func (r *Repository) IncomeEvents(ctx context.Context, userID int64, from, to time.Time) ([]domain.IncomeEvent, error) {
	rows, err := r.q.ListIncomeEvents(ctx, ListIncomeEventsParams{UserID: userID, FromDate: from, ToDate: to})
	out := make([]domain.IncomeEvent, len(rows))
	for i, row := range rows {
		out[i] = domain.IncomeEvent{
			TransactionID: row.TransactionID, AccountID: row.AccountID, Instrument: money.Currency(row.Instrument), Date: row.Date,
			Type: row.IncomeType, TaxTreatment: row.TaxTreatment, Gross: row.Gross, Withheld: row.Withheld, Currency: money.Currency(row.Currency),
		}
	}
	return out, err
}
