package postgres

import (
	"context"
	"encoding/json/v2"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toRecord(row IngestionExternalRecord) (domain.ExternalRecord, error) {
	var raw map[string]string
	if err := json.Unmarshal(row.Raw, &raw); err != nil {
		return domain.ExternalRecord{}, err
	}
	return domain.ExternalRecord{
		ID: row.ID, UserID: row.UserID, BatchID: row.BatchID, AccountID: row.AccountID, ExternalID: value(row.ExternalID),
		DedupKey: row.DedupKey, Raw: raw, Date: row.BookedOn, Amount: row.Amount, Description: row.Description,
		State: domain.RecordState(row.State), TransactionID: row.TransactionID.UUID, Candidates: row.Candidates,
	}, nil
}

// ClaimRecords inserts the file's records in one pipelined round trip; keys that exist come
// back from one more query.
func (r *Repository) ClaimRecords(ctx context.Context, recs []domain.ExternalRecord) ([]app.Claim, error) {
	out := make([]app.Claim, len(recs))
	if len(recs) == 0 {
		return out, nil
	}
	params := make([]InsertRecordsParams, len(recs))
	for i, rec := range recs {
		raw, err := json.Marshal(rec.Raw)
		if err != nil {
			return nil, err
		}
		params[i] = InsertRecordsParams{
			UserID: rec.UserID, BatchID: rec.BatchID, AccountID: rec.AccountID, ExternalID: optional(rec.ExternalID),
			DedupKey: rec.DedupKey, Raw: raw, BookedOn: rec.Date, Amount: rec.Amount, Description: rec.Description,
		}
	}
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		var existing [][]byte
		var batchErr error
		q.InsertRecords(ctx, params).QueryRow(func(i int, row IngestionExternalRecord, err error) {
			switch {
			case batchErr != nil:
			case errors.Is(err, pgx.ErrNoRows):
				out[i].Existed, existing = true, append(existing, recs[i].DedupKey)
			case err != nil:
				batchErr = err
			default:
				out[i].Record, batchErr = toRecord(row)
			}
		})
		if batchErr != nil || len(existing) == 0 {
			return batchErr
		}
		rows, err := q.ListRecordsByKeys(ctx, ListRecordsByKeysParams{UserID: recs[0].UserID, Keys: existing})
		if err != nil {
			return err
		}
		byKey := make(map[string]IngestionExternalRecord, len(rows))
		for _, row := range rows {
			byKey[string(row.DedupKey)] = row
		}
		for i := range out {
			if out[i].Existed {
				if out[i].Record, err = toRecord(byKey[string(recs[i].DedupKey)]); err != nil {
					return err
				}
			}
		}
		return nil
	})
	return out, err
}

func outcome(rec domain.ExternalRecord) SaveRecordOutcomesParams {
	candidates := rec.Candidates
	if candidates == nil {
		candidates = []uuid.UUID{}
	}
	return SaveRecordOutcomesParams{
		UserID: rec.UserID, ID: rec.ID, BatchID: rec.BatchID, State: string(rec.State),
		TransactionID: uuid.NullUUID{UUID: rec.TransactionID, Valid: rec.TransactionID != uuid.Nil}, Candidates: candidates,
	}
}

func saveOutcomes(ctx context.Context, q *Queries, recs []domain.ExternalRecord) error {
	params := make([]SaveRecordOutcomesParams, len(recs))
	for i, rec := range recs {
		params[i] = outcome(rec)
	}
	var first error
	q.SaveRecordOutcomes(ctx, params).Exec(func(_ int, err error) {
		if err != nil && first == nil {
			first = err
		}
	})
	return first
}

func (r *Repository) SaveOutcomes(ctx context.Context, recs []domain.ExternalRecord) error {
	if len(recs) == 0 {
		return nil
	}
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error { return saveOutcomes(ctx, r.q.WithTx(tx), recs) })
}

func (r *Repository) InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error) {
	row, err := r.q.InsertBatch(ctx, InsertBatchParams{
		UserID: b.UserID, AccountID: b.AccountID, Source: string(b.Source), FileName: b.FileName,
		Currency: b.Currency, PeriodFrom: b.PeriodFrom, PeriodTo: b.PeriodTo,
	})
	if err != nil {
		return domain.Batch{}, notFound(err)
	}
	return toBatch(row), nil
}

func (r *Repository) CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error) {
	c := b.Counts
	params := CompleteBatchParams{
		UserID: b.UserID, ID: b.ID, Received: int32(c.Received), Ignored: int32(c.Ignored), Matched: int32(c.Matched), //nolint:gosec // line counts of a 10 MiB file
		Created: int32(c.Created), NeedsReview: int32(c.NeedsReview), Discarded: int32(c.Discarded), //nolint:gosec // line counts of a 10 MiB file
		BalanceStatus: string(b.Balance.Status), BalanceReason: optional(b.Balance.Reason), BalanceDate: b.Balance.Date,
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

func (r *Repository) Batch(ctx context.Context, userID int64, id uuid.UUID) (domain.Batch, error) {
	row, err := r.q.GetBatch(ctx, GetBatchParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Batch{}, notFound(err)
	}
	return toBatch(row), nil
}

// LockAccountImports holds a session-level advisory lock on one pooled connection until the
// returned function runs, so that two imports of one account never process a record twice.
func (r *Repository) LockAccountImports(ctx context.Context, accountID uuid.UUID) (func(), error) {
	conn, err := r.pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	q := New(conn)
	if err := q.LockAccountImports(ctx, accountID.String()); err != nil {
		conn.Release()
		return nil, err
	}
	return func() {
		_ = q.UnlockAccountImports(context.WithoutCancel(ctx), accountID.String())
		conn.Release()
	}, nil
}

func (r *Repository) Record(ctx context.Context, userID int64, id uuid.UUID) (domain.ExternalRecord, error) {
	row, err := r.q.GetRecord(ctx, GetRecordParams{UserID: userID, ID: id})
	if err != nil {
		return domain.ExternalRecord{}, notFound(err)
	}
	return toRecord(row)
}

func (r *Repository) Records(ctx context.Context, userID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[app.RecordKey]) ([]domain.ExternalRecord, *app.RecordKey, error) {
	params := ListBatchRecordsParams{UserID: userID, BatchID: batchID, State: optional(string(state)), RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		params.AfterID = uuid.NullUUID{UUID: p.After.ID, Valid: true}
	}
	rows, err := r.q.ListBatchRecords(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	kept, more := page.Trim(rows, p.Limit)
	out := make([]domain.ExternalRecord, len(kept))
	for i, row := range kept {
		if out[i], err = toRecord(row); err != nil {
			return nil, nil, err
		}
	}
	if !more {
		return out, nil, nil
	}
	return out, &app.RecordKey{ID: kept[len(kept)-1].ID}, nil
}

func (r *Repository) ResolveRecord(ctx context.Context, rec domain.ExternalRecord) error {
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := saveOutcomes(ctx, q, []domain.ExternalRecord{rec}); err != nil {
			return err
		}
		return q.MoveReviewCount(ctx, MoveReviewCountParams{UserID: rec.UserID, ID: rec.BatchID, State: string(rec.State)})
	})
}
