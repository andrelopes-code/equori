package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

func (r *Repository) InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error) {
	row, err := r.q.InsertBatch(ctx, InsertBatchParams{
		BooksID:           b.BooksID,
		AccountID:         b.AccountID,
		Source:            string(b.Source),
		FileName:          optional(b.FileName),
		Currency:          b.Currency,
		PeriodFrom:        b.PeriodFrom,
		PeriodTo:          b.PeriodTo,
		ExternalAccountID: nullable(b.ExternalAccountID),
		SyncID:            nullableID(b.SyncID),
	})
	if err != nil {
		return domain.Batch{}, notFound(err)
	}

	return toBatch(row), nil
}

func (r *Repository) CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error) {
	c := b.Counts

	//nolint:gosec // line counts of a 10 MiB file
	params := CompleteBatchParams{
		BooksID:      b.BooksID,
		ID:           b.ID,
		Received:     int32(c.Received),
		Ignored:      int32(c.Ignored),
		Matched:      int32(c.Matched),
		Created:      int32(c.Created),
		NeedsReview:  int32(c.NeedsReview),
		Discarded:    int32(c.Discarded),
		Updated:      int32(c.Updated),
		Withdrawn:    int32(c.Withdrawn),
		ReIdentified: int32(c.ReIdentified),
		Paired:       int32(c.Paired),
		ReadEmpty:    b.ReadEmpty,
		BalanceStatus: string(
			b.Balance.Status,
		),
		BalanceReason: optional(b.Balance.Reason),
		BalanceDate:   b.Balance.Date,
	}
	if b.Balance.Date != nil {
		params.BalanceAmount = &b.Balance.Amount
	}

	row, err := r.q.CompleteBatch(ctx, params)
	if err != nil {
		return domain.Batch{}, err
	}

	return toBatch(row), nil
}

func (r *Repository) Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error) {
	row, err := r.q.GetBatch(ctx, GetBatchParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Batch{}, notFound(err)
	}

	return toBatch(row), nil
}
