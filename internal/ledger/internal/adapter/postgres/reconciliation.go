package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

func (r *Repository) LockAccount(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error) {
	row, err := r.q.GetAccountForUpdate(ctx, GetAccountForUpdateParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Account{}, notFound(err)
	}
	return toAccount(row), nil
}

func toAssertion(row LedgerBalanceAssertion) app.BalanceAssertion {
	return app.BalanceAssertion{
		ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, Date: row.Date,
		Amount: row.Amount, Source: row.Source, RecordedAt: row.RecordedAt,
	}
}

func (r *Repository) InsertBalanceAssertion(ctx context.Context, a app.BalanceAssertion) (app.BalanceAssertion, error) {
	row, err := r.q.InsertBalanceAssertion(ctx, InsertBalanceAssertionParams{
		UserID: a.UserID, AccountID: a.AccountID, Date: a.Date, Amount: a.Amount, Source: a.Source,
	})
	if err != nil {
		return app.BalanceAssertion{}, err
	}
	return toAssertion(row), nil
}

func (r *Repository) BalanceAssertions(ctx context.Context, userID int64, accountID uuid.UUID) ([]app.BalanceAssertion, error) {
	rows, err := r.q.ListBalanceAssertions(ctx, ListBalanceAssertionsParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return nil, err
	}
	out := make([]app.BalanceAssertion, len(rows))
	for i, row := range rows {
		out[i] = toAssertion(row)
	}
	return out, nil
}

// optionalDate returns nil for a query that found no row.
func optionalDate(d time.Time, err error) (*time.Time, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) LastReconciledOn(ctx context.Context, userID int64, accountID uuid.UUID) (*time.Time, error) {
	return optionalDate(r.q.LastReconciledOn(ctx, LastReconciledOnParams{UserID: userID, AccountID: accountID}))
}

func (r *Repository) FirstSettledOn(ctx context.Context, userID int64, accountID uuid.UUID) (*time.Time, error) {
	return optionalDate(r.q.FirstSettledOn(ctx, FirstSettledOnParams{UserID: userID, AccountID: accountID}))
}

func (r *Repository) InsertReconciliation(ctx context.Context, rec app.Reconciliation) error {
	return r.q.InsertReconciliation(ctx, InsertReconciliationParams{
		UserID: rec.UserID, AccountID: rec.AccountID, Date: rec.Date,
		AssertionID: nullUUID(rec.AssertionID), StatementID: nullUUID(rec.StatementID),
		Difference: rec.Difference, Resolution: string(rec.Resolution),
		ResolutionTransactionID: nullUUID(rec.ResolutionTransactionID),
	})
}

func (r *Repository) ReconcilePostings(ctx context.Context, userID int64, accountID uuid.UUID, through time.Time) error {
	return r.q.ReconcileAccountPostings(ctx, ReconcileAccountPostingsParams{UserID: userID, AccountID: accountID, OnDate: through})
}
