package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

var _ app.Repository = (*Repository)(nil)

// db is satisfied by *pgxpool.Pool and pgx.Tx (ADR 005).
type db interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Repository struct {
	db db
	q  *Queries
}

func NewRepository(db db) *Repository { return &Repository{db: db, q: New(db)} }

// AccountCurrency is the instrument of the account and its sub-accounts (P8 amendment A63).
func (r *Repository) AccountCurrency(ctx context.Context, userID int64, accountID uuid.UUID) (string, error) {
	cs, err := r.q.TreeInstruments(ctx, TreeInstrumentsParams{UserID: userID, AccountID: accountID})
	switch {
	case err != nil:
		return "", err
	case len(cs) == 0:
		return "", app.ErrNotFound
	case len(cs) > 1:
		return "", app.ErrMixedInstruments
	}
	return cs[0], nil
}

// Rebuild runs in one database transaction (a savepoint inside a caller's transaction),
// so readers never see a half-rebuilt series.
func (r *Repository) Rebuild(ctx context.Context, userID int64, accountID uuid.UUID, from time.Time) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.DeleteAccountDaysFrom(ctx, DeleteAccountDaysFromParams{AccountID: accountID, Date: from}); err != nil {
			return err
		}
		return q.InsertAccountDaysFrom(ctx, InsertAccountDaysFromParams{UserID: userID, AccountID: accountID, FromDate: from})
	})
}

func (r *Repository) TreeDailyDeltas(ctx context.Context, userID int64, accountID uuid.UUID, to time.Time) ([]app.DayDelta, error) {
	rows, err := r.q.TreeDailyDeltas(ctx, TreeDailyDeltasParams{UserID: userID, AccountID: accountID, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make([]app.DayDelta, len(rows))
	for i, row := range rows {
		out[i] = app.DayDelta{Date: row.Date, Booked: row.DeltaBooked, Settled: row.DeltaSettled}
	}
	return out, nil
}

func (r *Repository) AllAccounts(ctx context.Context) ([]app.AccountRef, error) {
	rows, err := r.q.ListAllAccounts(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]app.AccountRef, len(rows))
	for i, row := range rows {
		out[i] = app.AccountRef{UserID: row.UserID, AccountID: row.ID}
	}
	return out, nil
}

func (r *Repository) CategoryTotals(ctx context.Context, userID int64, class string, from, to time.Time) ([]app.CategoryRow, error) {
	rows, err := r.q.CategoryTotals(ctx, CategoryTotalsParams{UserID: userID, AccountClass: class, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make([]app.CategoryRow, len(rows))
	for i, row := range rows {
		out[i] = app.CategoryRow{ID: row.ID, ParentID: row.ParentID.UUID, Instrument: row.Instrument, Closed: row.ClosedOn != nil, Total: row.Total}
	}
	return out, nil
}
