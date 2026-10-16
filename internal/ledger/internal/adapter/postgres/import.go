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

func (r *Repository) UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]app.UnlinkedPosting, error) {
	rows, err := r.q.ListUnlinkedPostings(ctx, ListUnlinkedPostingsParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
	return mapAll(rows, func(row ListUnlinkedPostingsRow) app.UnlinkedPosting {
		return app.UnlinkedPosting{TransactionID: row.TransactionID, Date: row.BookedOn, Amount: row.Amount}
	}), err
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

func (r *Repository) TransactionsByExternalRecords(ctx context.Context, userID int64, recordIDs []uuid.UUID) (map[uuid.UUID]uuid.UUID, error) {
	rows, err := r.q.ListTransactionsByExternalRecords(ctx, ListTransactionsByExternalRecordsParams{UserID: userID, RecordIds: recordIDs})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]uuid.UUID, len(rows))
	for _, row := range rows {
		out[row.ExternalRecordID.UUID] = row.ID
	}
	return out, nil
}

func (r *Repository) LockTransactionLink(ctx context.Context, userID int64, txID uuid.UUID) (uuid.UUID, bool, error) {
	row, err := r.q.GetTransactionLinkForUpdate(ctx, GetTransactionLinkForUpdateParams{UserID: userID, ID: txID})
	if err != nil {
		return uuid.Nil, false, notFound(err)
	}
	return row.ExternalRecordID.UUID, row.Voided, nil
}
