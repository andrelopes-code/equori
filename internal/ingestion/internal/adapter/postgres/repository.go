package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
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

func toBatch(row IngestionBatch) domain.Batch {
	b := domain.Batch{
		ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, Source: domain.Source(row.Source),
		FileName: row.FileName, Currency: row.Currency, PeriodFrom: row.PeriodFrom, PeriodTo: row.PeriodTo,
		Counts: domain.Counts{
			Received: int(row.Received), Ignored: int(row.Ignored), Matched: int(row.Matched),
			Created: int(row.Created), NeedsReview: int(row.NeedsReview), Discarded: int(row.Discarded),
		},
		Balance:   domain.FileBalance{Status: domain.BalanceStatus(row.BalanceStatus), Date: row.BalanceDate},
		StartedAt: row.StartedAt, CompletedAt: row.CompletedAt,
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
	kept, more := page.Trim(rows, p.Limit)
	out := make([]domain.Batch, len(kept))
	for i, row := range kept {
		out[i] = toBatch(row)
	}
	if !more {
		return out, nil, nil
	}
	last := kept[len(kept)-1]
	return out, &app.BatchKey{StartedAt: last.StartedAt, ID: last.ID}, nil
}
