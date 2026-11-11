package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/app"
)

func (r *Repository) InsertDispute(ctx context.Context, d app.Dispute) (app.Dispute, error) {
	row, err := r.q.InsertDispute(ctx, InsertDisputeParams{BooksID: d.BooksID, TransactionID: d.TransactionID, OpenedOn: d.OpenedOn})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return app.Dispute{}, app.ErrDisputeOpen
	}

	if err != nil {
		return app.Dispute{}, err
	}

	return toDispute(row), nil
}

func (r *Repository) Disputes(ctx context.Context, booksID int64, transactionID uuid.UUID) ([]app.Dispute, error) {
	rows, err := r.q.ListDisputes(ctx, ListDisputesParams{BooksID: booksID, TransactionID: transactionID})
	if err != nil {
		return nil, err
	}

	out := make([]app.Dispute, len(rows))
	for i, row := range rows {
		out[i] = toDispute(row)
	}

	return out, nil
}

func (r *Repository) LockDispute(ctx context.Context, booksID int64, id uuid.UUID) (app.Dispute, error) {
	row, err := r.q.GetDisputeForUpdate(ctx, GetDisputeForUpdateParams{BooksID: booksID, ID: id})
	if err != nil {
		return app.Dispute{}, notFound(err)
	}

	return toDispute(row), nil
}

func (r *Repository) ResolveDispute(ctx context.Context, d app.Dispute) (app.Dispute, error) {
	row, err := r.q.ResolveDispute(ctx, ResolveDisputeParams{
		ID: d.ID, ResolvedOn: d.ResolvedOn, Outcome: nullString(d.Outcome), RefundTransactionID: nullUUID(d.RefundTransactionID),
	})
	if err != nil {
		return app.Dispute{}, err
	}

	return toDispute(row), nil
}

func toDispute(row LedgerDispute) app.Dispute {
	return app.Dispute{
		ID: row.ID, BooksID: row.BooksID, TransactionID: row.TransactionID, OpenedOn: row.OpenedOn,
		ResolvedOn: row.ResolvedOn, Outcome: deref(row.Outcome), RefundTransactionID: row.RefundTransactionID.UUID,
	}
}
