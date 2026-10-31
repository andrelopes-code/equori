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

// undoRow is a record's Undo as decision_undo stores it (A148); WithdrawRecords and
// ReidentifyRecord build the same keys in SQL.
type undoRow struct {
	Amount        int64             `json:"amount,omitzero"`
	On            string            `json:"on,omitzero"` // time.DateOnly
	State         string            `json:"state,omitzero"`
	TransactionID string            `json:"transaction_id,omitzero"`
	ReviewReason  string            `json:"review_reason,omitzero"`
	ExternalID    string            `json:"external_id,omitzero"`
	DedupKey      []byte            `json:"dedup_key,omitzero"`
	Raw           map[string]string `json:"raw,omitzero"`
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

	undo, err := decodeUndo(row.DecisionUndo)
	if err != nil {
		return domain.ExternalRecord{}, err
	}

	rec := domain.ExternalRecord{
		ID: row.ID, BooksID: row.BooksID, BatchID: row.BatchID, AccountID: row.AccountID, ExternalID: value(row.ExternalID),
		DedupKey: row.DedupKey, Raw: raw, Date: row.BookedOn, Amount: row.Amount, Description: row.Description,
		State: domain.RecordState(row.State), TransactionID: row.TransactionID.UUID, Candidates: row.Candidates,
		ExternalStatus: value(row.ExternalStatus), DueDate: row.DueDate, CategoryID: value(row.CategoryID),
		BalanceAfter: row.BalanceAfter, LineKind: value(row.LineKind), UnappliedChange: value(row.UnappliedChange),
		ReviewReason: value(row.ReviewReason), InstitutionID: value(row.InstitutionID),
		ReportedAmount: row.ReportedAmount, ReportedOn: row.ReportedOn,
		Decision: domain.DecisionKind(value(row.Decision)), Undo: undo, SummaryBatchID: row.SummaryBatchID.UUID, Kept: row.Kept,
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
	institution            *string
	number, count          *int32
	dueDate                *time.Time
	balanceAfter           *int64
}

func factsOf(rec domain.ExternalRecord) facts {
	f := facts{status: optional(rec.ExternalStatus), category: optional(rec.CategoryID), kind: optional(rec.LineKind), dueDate: rec.DueDate, balanceAfter: rec.BalanceAfter,
		institution: optional(rec.InstitutionID)}
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
		var err error
		if params[i], err = insertParams(rec); err != nil {
			return nil, err
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

		rows, err := q.ListRecordsByKeys(ctx, ListRecordsByKeysParams{BooksID: recs[0].BooksID, Keys: existing})
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

func insertParams(rec domain.ExternalRecord) (InsertRecordsParams, error) {
	raw, err := json.Marshal(rec.Raw)
	if err != nil {
		return InsertRecordsParams{}, err
	}

	f := factsOf(rec)

	return InsertRecordsParams{
		BooksID: rec.BooksID, BatchID: rec.BatchID, AccountID: rec.AccountID, ExternalID: optional(rec.ExternalID),
		DedupKey: rec.DedupKey, Raw: raw, BookedOn: rec.Date, Amount: rec.Amount, Description: rec.Description,
		ExternalStatus: f.status, DueDate: f.dueDate, InstallmentNumber: f.number, InstallmentCount: f.count,
		CategoryID: f.category, BalanceAfter: f.balanceAfter, LineKind: f.kind,
		InstitutionID: f.institution, ReportedAmount: rec.ReportedAmount, ReportedOn: rec.ReportedOn,
	}, nil
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
	if err != nil {
		return SaveRecordOutcomesParams{}, err
	}

	undo, err := encodeUndo(rec.Undo)

	return SaveRecordOutcomesParams{
		BooksID: rec.BooksID, ID: rec.ID, BatchID: rec.BatchID, State: string(rec.State),
		TransactionID: uuid.NullUUID{UUID: rec.TransactionID, Valid: rec.TransactionID != uuid.Nil}, Candidates: candidates,
		ReviewReason: optional(rec.ReviewReason), CandidateScores: stored,
		Decision: optional(string(rec.Decision)), DecisionUndo: undo, SummaryBatchID: nullableID(rec.SummaryBatchID),
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
		BooksID: b.BooksID, AccountID: b.AccountID, Source: string(b.Source), FileName: optional(b.FileName),
		Currency: b.Currency, PeriodFrom: b.PeriodFrom, PeriodTo: b.PeriodTo, ExternalAccountID: nullable(b.ExternalAccountID),
		SyncID: nullableID(b.SyncID),
	})
	if err != nil {
		return domain.Batch{}, notFound(err)
	}

	return toBatch(row), nil
}

func (r *Repository) CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error) {
	c := b.Counts

	params := CompleteBatchParams{
		BooksID: b.BooksID, ID: b.ID, Received: int32(c.Received), Ignored: int32(c.Ignored), Matched: int32(c.Matched), //nolint:gosec // line counts of a 10 MiB file
		Created: int32(c.Created), NeedsReview: int32(c.NeedsReview), Discarded: int32(c.Discarded), //nolint:gosec // line counts of a 10 MiB file
		Updated: int32(c.Updated), Withdrawn: int32(c.Withdrawn), //nolint:gosec // line counts of one account window
		ReIdentified: int32(c.ReIdentified), ReadEmpty: b.ReadEmpty, //nolint:gosec // line counts of one account window
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

func (r *Repository) Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error) {
	row, err := r.q.GetBatch(ctx, GetBatchParams{BooksID: booksID, ID: id})
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

func (r *Repository) Record(ctx context.Context, booksID int64, id uuid.UUID) (domain.ExternalRecord, error) {
	row, err := r.q.GetRecord(ctx, GetRecordParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.ExternalRecord{}, notFound(err)
	}

	return toRecord(row)
}

func (r *Repository) Records(ctx context.Context, booksID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[app.RecordKey]) ([]domain.ExternalRecord, *app.RecordKey, error) {
	params := ListBatchRecordsParams{BooksID: booksID, BatchID: batchID, State: optional(string(state)), RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
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

		return q.MoveReviewCount(ctx, MoveReviewCountParams{BooksID: rec.BooksID, ID: rec.BatchID, State: string(rec.State)})
	})
}

// ReopenRecord returns a discarded record to review and moves it between the batch counts; it
// reports false when the record is not discarded (A140).
func (r *Repository) ReopenRecord(ctx context.Context, booksID int64, id, batchID uuid.UUID) (bool, error) {
	reopened := false
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		n, err := q.ReopenRecord(ctx, ReopenRecordParams{BooksID: booksID, ID: id})
		if err != nil || n == 0 {
			return err
		}

		reopened = true

		return q.MoveReopenedCount(ctx, MoveReopenedCountParams{BooksID: booksID, ID: batchID})
	})

	return reopened, err
}

// SaveUndo stores a record after the undo of its decision, moves it out of the count of left
// when it entered review, and inserts line, when not nil, as a new record in review (A148).
func (r *Repository) SaveUndo(ctx context.Context, rec domain.ExternalRecord, decided domain.DecisionKind, left domain.RecordState, line *domain.ExternalRecord) error {
	params, err := undoParams(rec, decided)
	if err != nil {
		return err
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		n, err := q.UndoRecordDecision(ctx, params)
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrNoDecision
		}

		if rec.State == domain.StateNeedsReview && left != domain.StateNeedsReview {
			if err := q.MoveUndoneCount(ctx, MoveUndoneCountParams{BooksID: rec.BooksID, ID: rec.BatchID, LeftState: string(left)}); err != nil {
				return err
			}
		}

		if line == nil {
			return nil
		}

		return insertUndoneLine(ctx, q, line)
	})
}

func undoParams(rec domain.ExternalRecord, decided domain.DecisionKind) (UndoRecordDecisionParams, error) {
	raw, err := json.Marshal(rec.Raw)
	if err != nil {
		return UndoRecordDecisionParams{}, err
	}

	o, err := outcome(rec)
	if err != nil {
		return UndoRecordDecisionParams{}, err
	}

	return UndoRecordDecisionParams{
		ExternalID: optional(rec.ExternalID), DedupKey: rec.DedupKey, Raw: raw, BookedOn: rec.Date, Amount: rec.Amount,
		State: o.State, TransactionID: o.TransactionID, Candidates: o.Candidates, CandidateScores: o.CandidateScores,
		ReviewReason: o.ReviewReason, UnappliedChange: optional(rec.UnappliedChange), Kept: rec.Kept,
		BooksID: rec.BooksID, ID: rec.ID, Decision: string(decided),
	}, nil
}

// insertUndoneLine adds the line of an undone re-identification as a record in review of its
// batch, and counts it there.
func insertUndoneLine(ctx context.Context, q *Queries, line *domain.ExternalRecord) error {
	params, err := insertParams(*line)
	if err != nil {
		return err
	}

	var inserted IngestionExternalRecord

	var insertErr error

	q.InsertRecords(ctx, []InsertRecordsParams{params}).QueryRow(func(_ int, row IngestionExternalRecord, err error) {
		inserted, insertErr = row, err
	})

	if insertErr != nil {
		return insertErr
	}

	line.ID = inserted.ID

	if err := saveOutcomes(ctx, q, []domain.ExternalRecord{*line}); err != nil {
		return err
	}

	return q.MoveUndoneCount(ctx, MoveUndoneCountParams{BooksID: line.BooksID, ID: line.BatchID, LeftState: string(domain.StateReceived)})
}

func encodeUndo(u domain.Undo) ([]byte, error) {
	row := undoRow{
		Amount: u.Amount, State: string(u.State), ReviewReason: u.ReviewReason,
		ExternalID: u.ExternalID, DedupKey: u.DedupKey, Raw: u.Raw,
	}
	if !u.On.IsZero() {
		row.On = u.On.Format(time.DateOnly)
	}

	if u.TransactionID != uuid.Nil {
		row.TransactionID = u.TransactionID.String()
	}

	return json.Marshal(row)
}

func decodeUndo(stored []byte) (domain.Undo, error) {
	var row undoRow
	if err := json.Unmarshal(stored, &row); err != nil {
		return domain.Undo{}, err
	}

	u := domain.Undo{
		Amount: row.Amount, State: domain.RecordState(row.State), ReviewReason: row.ReviewReason,
		ExternalID: row.ExternalID, DedupKey: row.DedupKey, Raw: row.Raw,
	}

	var err error
	if row.On != "" {
		if u.On, err = time.Parse(time.DateOnly, row.On); err != nil {
			return domain.Undo{}, err
		}
	}

	if row.TransactionID != "" {
		if u.TransactionID, err = uuid.Parse(row.TransactionID); err != nil {
			return domain.Undo{}, err
		}
	}

	return u, nil
}
