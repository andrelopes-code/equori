package postgres

import (
	"context"
	"encoding/json/v2"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// scoreRow is one scored candidate as candidate_scores stores it (A100).
type scoreRow struct {
	TransactionID uuid.UUID `json:"transaction_id"`
	Score         int       `json:"score"`
	Amount        string    `json:"amount"`
	Date          string    `json:"date"`
	Counterparty  string    `json:"counterparty"`
}

func toRecord(row IngestionExternalRecord) (domain.ExternalRecord, error) {
	var raw map[string]string
	if err := json.Unmarshal(row.Raw, &raw); err != nil {
		return domain.ExternalRecord{}, err
	}
	var scores []scoreRow
	if err := json.Unmarshal(row.CandidateScores, &scores); err != nil {
		return domain.ExternalRecord{}, err
	}
	rec := domain.ExternalRecord{
		ID: row.ID, UserID: row.UserID, BatchID: row.BatchID, AccountID: row.AccountID, ExternalID: value(row.ExternalID),
		DedupKey: row.DedupKey, Raw: raw, Date: row.BookedOn, Amount: row.Amount, Description: row.Description,
		State: domain.RecordState(row.State), TransactionID: row.TransactionID.UUID, Candidates: row.Candidates,
		ExternalStatus: value(row.ExternalStatus), DueDate: row.DueDate, CategoryID: value(row.CategoryID),
		BalanceAfter: row.BalanceAfter, LineKind: value(row.LineKind), UnappliedChange: value(row.UnappliedChange),
		ReviewReason: value(row.ReviewReason),
	}
	for _, s := range scores {
		rec.Scores = append(rec.Scores, domain.Scored{
			TransactionID: s.TransactionID, Score: s.Score, Amount: s.Amount, Date: s.Date, Counterparty: s.Counterparty,
		})
	}
	if row.InstallmentNumber != nil && row.InstallmentCount != nil {
		rec.Installment = &domain.Installment{Number: int(*row.InstallmentNumber), Count: int(*row.InstallmentCount)}
	}
	return rec, nil
}

// facts are the aggregator columns of a record.
type facts struct {
	status, category, kind *string
	number, count          *int32
	dueDate                *time.Time
	balanceAfter           *int64
}

func factsOf(rec domain.ExternalRecord) facts {
	f := facts{status: optional(rec.ExternalStatus), category: optional(rec.CategoryID), kind: optional(rec.LineKind), dueDate: rec.DueDate, balanceAfter: rec.BalanceAfter}
	if i := rec.Installment; i != nil {
		n, c := int32(i.Number), int32(i.Count) //nolint:gosec // at most 420 installments (ledger rule)
		f.number, f.count = &n, &c
	}
	return f
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
		f := factsOf(rec)
		params[i] = InsertRecordsParams{
			UserID: rec.UserID, BatchID: rec.BatchID, AccountID: rec.AccountID, ExternalID: optional(rec.ExternalID),
			DedupKey: rec.DedupKey, Raw: raw, BookedOn: rec.Date, Amount: rec.Amount, Description: rec.Description,
			ExternalStatus: f.status, DueDate: f.dueDate, InstallmentNumber: f.number, InstallmentCount: f.count,
			CategoryID: f.category, BalanceAfter: f.balanceAfter, LineKind: f.kind,
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

func outcome(rec domain.ExternalRecord) (SaveRecordOutcomesParams, error) {
	candidates := rec.Candidates
	if candidates == nil {
		candidates = []uuid.UUID{}
	}
	scores := make([]scoreRow, len(rec.Scores))
	for i, s := range rec.Scores {
		scores[i] = scoreRow{TransactionID: s.TransactionID, Score: s.Score, Amount: s.Amount, Date: s.Date, Counterparty: s.Counterparty}
	}
	stored, err := json.Marshal(scores)
	return SaveRecordOutcomesParams{
		UserID: rec.UserID, ID: rec.ID, BatchID: rec.BatchID, State: string(rec.State),
		TransactionID: uuid.NullUUID{UUID: rec.TransactionID, Valid: rec.TransactionID != uuid.Nil}, Candidates: candidates,
		ReviewReason: optional(rec.ReviewReason), CandidateScores: stored,
	}, err
}

func saveOutcomes(ctx context.Context, q *Queries, recs []domain.ExternalRecord) error {
	params := make([]SaveRecordOutcomesParams, len(recs))
	for i, rec := range recs {
		var err error
		if params[i], err = outcome(rec); err != nil {
			return err
		}
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
		UserID: b.UserID, AccountID: b.AccountID, Source: string(b.Source), FileName: optional(b.FileName),
		Currency: b.Currency, PeriodFrom: b.PeriodFrom, PeriodTo: b.PeriodTo, ExternalAccountID: nullable(b.ExternalAccountID),
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
		Updated: int32(c.Updated), Withdrawn: int32(c.Withdrawn), //nolint:gosec // line counts of one account window
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

// ReopenRecord returns a discarded record to review and moves it between the batch counts; it
// reports false when the record is not discarded (A140).
func (r *Repository) ReopenRecord(ctx context.Context, userID int64, id, batchID uuid.UUID) (bool, error) {
	reopened := false
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		n, err := q.ReopenRecord(ctx, ReopenRecordParams{UserID: userID, ID: id})
		if err != nil || n == 0 {
			return err
		}

		reopened = true
		return q.MoveReopenedCount(ctx, MoveReopenedCountParams{UserID: userID, ID: batchID})
	})
	return reopened, err
}
