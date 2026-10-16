package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
)

func (r *Repository) TransactionByExternalRecord(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, error) {
	id, err := r.q.GetTransactionIDByExternalRecord(ctx, GetTransactionIDByExternalRecordParams{UserID: userID, ExternalRecordID: nullUUID(recordID)})
	return id, notFound(err)
}

func (r *Repository) MatchCandidates(ctx context.Context, userID int64, accountID uuid.UUID, amount int64, from, to time.Time) ([]uuid.UUID, error) {
	rows, err := r.q.ListMatchCandidates(ctx, ListMatchCandidatesParams{UserID: userID, AccountID: accountID, Amount: amount, FromDate: from, ToDate: to})
	return mapAll(rows, func(row ListMatchCandidatesRow) uuid.UUID { return row.ID }), err
}

func (r *Repository) LinkExternalRecord(ctx context.Context, userID int64, txID, recordID uuid.UUID) error {
	err := r.q.LinkExternalRecord(ctx, LinkExternalRecordParams{UserID: userID, ID: txID, ExternalRecordID: nullUUID(recordID)})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return app.ErrAlreadyMatched
	}
	return err
}

func (r *Repository) ClearPendingPostings(ctx context.Context, userID int64, txID, accountID uuid.UUID) error {
	return r.q.ClearPendingPostings(ctx, ClearPendingPostingsParams{UserID: userID, TransactionID: txID, AccountID: accountID})
}
