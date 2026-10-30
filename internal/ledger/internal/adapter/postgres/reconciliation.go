package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

func (r *Repository) LockAccount(ctx context.Context, booksID int64, id uuid.UUID) (domain.Account, error) {
	row, err := r.q.GetAccountForUpdate(ctx, GetAccountForUpdateParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Account{}, notFound(err)
	}

	return toAccount(row), nil
}

func toAssertion(row LedgerBalanceAssertion, reconciled bool) app.BalanceAssertion {
	return app.BalanceAssertion{
		ID: row.ID, BooksID: row.BooksID, AccountID: row.AccountID, Date: row.Date,
		Amount: row.Amount, Source: row.Source, RecordedAt: row.RecordedAt, Reconciled: reconciled,
	}
}

func (r *Repository) InsertBalanceAssertion(ctx context.Context, a app.BalanceAssertion) (app.BalanceAssertion, error) {
	row, err := r.q.InsertBalanceAssertion(ctx, InsertBalanceAssertionParams{
		BooksID: a.BooksID, AccountID: a.AccountID, Date: a.Date, Amount: a.Amount, Source: a.Source,
	})
	if err != nil {
		return app.BalanceAssertion{}, err
	}

	return toAssertion(row, false), nil
}

func (r *Repository) BalanceAssertion(ctx context.Context, booksID int64, id uuid.UUID) (app.BalanceAssertion, error) {
	row, err := r.q.GetBalanceAssertion(ctx, GetBalanceAssertionParams{BooksID: booksID, ID: id})
	if err != nil {
		return app.BalanceAssertion{}, notFound(err)
	}

	return toAssertion(LedgerBalanceAssertion{
		ID: row.ID, BooksID: row.BooksID, AccountID: row.AccountID, Date: row.Date,
		Amount: row.Amount, Source: row.Source, RecordedAt: row.RecordedAt,
	}, row.Reconciled), nil
}

func (r *Repository) BalanceAssertionPage(ctx context.Context, booksID int64, accountID uuid.UUID, p page.Request[app.AssertionKey]) ([]app.BalanceAssertion, *app.AssertionKey, error) {
	params := ListBalanceAssertionPageParams{BooksID: booksID, AccountID: accountID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterDate, params.AfterID = &p.After.Date, nullUUID(p.After.ID)
	}

	rows, err := r.q.ListBalanceAssertionPage(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	items, next := pageOf(rows, p.Limit,
		func(row ListBalanceAssertionPageRow) app.BalanceAssertion {
			return toAssertion(LedgerBalanceAssertion{
				ID: row.ID, BooksID: row.BooksID, AccountID: row.AccountID, Date: row.Date,
				Amount: row.Amount, Source: row.Source, RecordedAt: row.RecordedAt,
			}, row.Reconciled)
		},
		func(row ListBalanceAssertionPageRow) app.AssertionKey {
			return app.AssertionKey{Date: row.Date, ID: row.ID}
		})

	return items, next, nil
}

func (r *Repository) BalanceAssertions(ctx context.Context, booksID int64, accountID uuid.UUID) ([]app.BalanceAssertion, error) {
	rows, err := r.q.ListBalanceAssertions(ctx, ListBalanceAssertionsParams{BooksID: booksID, AccountID: accountID})
	if err != nil {
		return nil, err
	}

	out := make([]app.BalanceAssertion, len(rows))
	for i, row := range rows {
		out[i] = toAssertion(LedgerBalanceAssertion{
			ID: row.ID, BooksID: row.BooksID, AccountID: row.AccountID, Date: row.Date,
			Amount: row.Amount, Source: row.Source, RecordedAt: row.RecordedAt,
		}, row.Reconciled)
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

func (r *Repository) LastReconciledOn(ctx context.Context, booksID int64, accountID uuid.UUID) (*time.Time, error) {
	return optionalDate(r.q.LastReconciledOn(ctx, LastReconciledOnParams{BooksID: booksID, AccountID: accountID}))
}

func (r *Repository) FirstSettledOn(ctx context.Context, booksID int64, accountID uuid.UUID) (*time.Time, error) {
	return optionalDate(r.q.FirstSettledOn(ctx, FirstSettledOnParams{BooksID: booksID, AccountID: accountID}))
}

func (r *Repository) InsertReconciliation(ctx context.Context, rec app.Reconciliation) error {
	err := r.q.InsertReconciliation(ctx, InsertReconciliationParams{
		BooksID: rec.BooksID, AccountID: rec.AccountID, Date: rec.Date,
		AssertionID: nullUUID(rec.AssertionID), StatementID: nullUUID(rec.StatementID),
		Difference: rec.Difference, Resolution: string(rec.Resolution),
		ResolutionTransactionID: nullUUID(rec.ResolutionTransactionID),
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return domain.ErrAlreadyReconciled
	}

	return err
}

func (r *Repository) ReconcileStatementPostings(ctx context.Context, booksID int64, statementID uuid.UUID) error {
	return r.q.ReconcileStatementPostings(ctx, ReconcileStatementPostingsParams{BooksID: booksID, StatementID: nullUUID(statementID)})
}

func (r *Repository) ReconcilePostings(ctx context.Context, booksID int64, accountID uuid.UUID, through time.Time) error {
	return r.q.ReconcileAccountPostings(ctx, ReconcileAccountPostingsParams{BooksID: booksID, AccountID: accountID, OnDate: through})
}

// UnlockAccount bypasses the I05 trigger for the current database transaction only (A8).
func (r *Repository) UnlockAccount(ctx context.Context, booksID int64, accountID uuid.UUID, from time.Time) error {
	if r.tx == nil {
		return errors.New("unlock outside a transaction")
	}

	if err := r.q.EnableReconciledUnlock(ctx); err != nil {
		return err
	}

	if err := r.q.UnreconcileAccountPostings(ctx, UnreconcileAccountPostingsParams{BooksID: booksID, AccountID: accountID, FromDate: from}); err != nil {
		return err
	}

	return r.q.DeleteReconciliationsFrom(ctx, DeleteReconciliationsFromParams{BooksID: booksID, AccountID: accountID, FromDate: from})
}
