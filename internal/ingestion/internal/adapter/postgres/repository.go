package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var _ app.Repository = (*Repository)(nil)

type Repository struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool, q: New(pool)} }

// NewTxRepository runs on an outbox delivery's transaction; it serves MoveRecords only.
func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{q: New(tx)} }

func (r *Repository) MoveRecords(ctx context.Context, userID int64, recordIDs []uuid.UUID, transactionID uuid.UUID) error {
	return r.q.MoveRecords(ctx, MoveRecordsParams{UserID: userID, RecordIds: recordIDs, TransactionID: uuid.NullUUID{UUID: transactionID, Valid: true}})
}

func toBatch(row IngestionBatch) domain.Batch {
	b := domain.Batch{
		ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, Source: domain.Source(row.Source),
		FileName: value(row.FileName), Currency: row.Currency, PeriodFrom: row.PeriodFrom, PeriodTo: row.PeriodTo,
		Counts: domain.Counts{
			Received: int(row.Received), Ignored: int(row.Ignored), Matched: int(row.Matched),
			Created: int(row.Created), NeedsReview: int(row.NeedsReview), Discarded: int(row.Discarded),
			Updated: int(row.Updated), Withdrawn: int(row.Withdrawn),
		},
		Balance:   domain.FileBalance{Status: domain.BalanceStatus(row.BalanceStatus), Date: row.BalanceDate},
		StartedAt: row.StartedAt, CompletedAt: row.CompletedAt,
	}
	if row.ExternalAccountID.Valid {
		b.ExternalAccountID = &row.ExternalAccountID.UUID
	}
	if row.BalanceAmount != nil {
		b.Balance.Amount = *row.BalanceAmount
	}
	if row.BalanceReason != nil {
		b.Balance.Reason = *row.BalanceReason
	}
	return b
}

func (r *Repository) ListBatches(ctx context.Context, userID int64, p page.Request[app.BatchKey]) ([]domain.Batch, *app.BatchKey, error) {
	params := ListBatchesParams{UserID: userID, RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		params.AfterStarted, params.AfterID = &p.After.StartedAt, uuid.NullUUID{UUID: p.After.ID, Valid: true}
	}
	rows, err := r.q.ListBatches(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	out, next := trimPage(rows, p.Limit, toBatch, func(row IngestionBatch) app.BatchKey {
		return app.BatchKey{StartedAt: row.StartedAt, ID: row.ID}
	})
	return out, next, nil
}

// trimPage converts the rows of a page read with one extra row; the key of the last kept
// row is the next page's cursor when the extra row exists.
func trimPage[R, T, K any](rows []R, limit int, convert func(R) T, key func(R) K) ([]T, *K) {
	kept, more := page.Trim(rows, limit)
	out := make([]T, len(kept))
	for i, row := range kept {
		out[i] = convert(row)
	}
	if !more {
		return out, nil
	}
	k := key(kept[len(kept)-1])
	return out, &k
}
