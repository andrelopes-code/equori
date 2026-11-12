package postgres

import (
	"context"
	"encoding/json/v2"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
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

	undo, err := decodeUndo(row.DecisionUndo)
	if err != nil {
		return domain.ExternalRecord{}, err
	}

	rec := domain.ExternalRecord{
		ID:          row.ID,
		BooksID:     row.BooksID,
		BatchID:     row.BatchID,
		AccountID:   row.AccountID,
		ExternalID:  value(row.ExternalID),
		DedupKey:    row.DedupKey,
		Raw:         raw,
		Date:        row.BookedOn,
		Amount:      row.Amount,
		Description: row.Description,
		State: domain.RecordState(
			row.State,
		),
		TransactionID: row.TransactionID.UUID,
		Candidates:    row.Candidates,
		ExternalStatus: value(
			row.ExternalStatus,
		),
		DueDate:         row.DueDate,
		CategoryID:      value(row.CategoryID),
		BalanceAfter:    row.BalanceAfter,
		LineKind:        value(row.LineKind),
		UnappliedChange: value(row.UnappliedChange),
		ReviewReason:    value(row.ReviewReason),
		InstitutionID:   value(row.InstitutionID),
		ReportedAmount:  row.ReportedAmount,
		ReportedOn:      row.ReportedOn,
		Counterparty:    value(row.Counterparty),
		Decision: domain.DecisionKind(
			value(row.Decision),
		),
		Undo:           undo,
		SummaryBatchID: row.SummaryBatchID.UUID,
		Kept:           row.Kept,
	}
	for _, s := range scores {
		rec.Scores = append(rec.Scores, domain.Scored{
			TransactionID: s.TransactionID,
			Score:         s.Score,
			Amount:        s.Amount,
			Date:          s.Date,
			Counterparty:  s.Counterparty,
		})
	}

	if row.InstallmentNumber != nil && row.InstallmentCount != nil {
		rec.Installment = &domain.Installment{
			Number: int(*row.InstallmentNumber),
			Count:  int(*row.InstallmentCount),
		}
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
	f := facts{
		status:       optional(rec.ExternalStatus),
		category:     optional(rec.CategoryID),
		kind:         optional(rec.LineKind),
		dueDate:      rec.DueDate,
		balanceAfter: rec.BalanceAfter,
		institution:  optional(rec.InstitutionID),
	}
	if i := rec.Installment; i != nil {
		//nolint:gosec // at most 420 installments (ledger rule)
		n, c := int32(i.Number), int32(i.Count)
		f.number, f.count = &n, &c
	}

	return f
}

// ClaimRecords inserts the file's records in one pipelined round trip; keys that exist come
// back from one more query.
func (r *Repository) ClaimRecords(
	ctx context.Context,
	recs []domain.ExternalRecord,
) ([]app.Claim, error) {
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
		return claimInTx(ctx, r.q.WithTx(tx), recs, params, out)
	})

	return out, err
}

func claimInTx(
	ctx context.Context,
	q *Queries,
	recs []domain.ExternalRecord,
	params []InsertRecordsParams,
	out []app.Claim,
) error {
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

	return fillExisting(ctx, q, recs, existing, out)
}

func fillExisting(
	ctx context.Context,
	q *Queries,
	recs []domain.ExternalRecord,
	existing [][]byte,
	out []app.Claim,
) error {
	rows, err := q.ListRecordsByKeys(
		ctx,
		ListRecordsByKeysParams{BooksID: recs[0].BooksID, Keys: existing},
	)
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
}

func insertParams(rec domain.ExternalRecord) (InsertRecordsParams, error) {
	raw, err := json.Marshal(rec.Raw)
	if err != nil {
		return InsertRecordsParams{}, err
	}

	f := factsOf(rec)

	return InsertRecordsParams{
		BooksID:           rec.BooksID,
		BatchID:           rec.BatchID,
		AccountID:         rec.AccountID,
		ExternalID:        optional(rec.ExternalID),
		DedupKey:          rec.DedupKey,
		Raw:               raw,
		BookedOn:          rec.Date,
		Amount:            rec.Amount,
		Description:       rec.Description,
		ExternalStatus:    f.status,
		DueDate:           f.dueDate,
		InstallmentNumber: f.number,
		InstallmentCount:  f.count,
		CategoryID:        f.category,
		BalanceAfter:      f.balanceAfter,
		LineKind:          f.kind,
		InstitutionID:     f.institution,
		ReportedAmount:    rec.ReportedAmount,
		ReportedOn:        rec.ReportedOn,
		Counterparty:      optional(rec.Counterparty),
	}, nil
}

func outcome(rec domain.ExternalRecord) (SaveRecordOutcomesParams, error) {
	candidates := rec.Candidates
	if candidates == nil {
		candidates = []uuid.UUID{}
	}

	scores := make([]scoreRow, len(rec.Scores))
	for i, s := range rec.Scores {
		scores[i] = scoreRow{
			TransactionID: s.TransactionID,
			Score:         s.Score,
			Amount:        s.Amount,
			Date:          s.Date,
			Counterparty:  s.Counterparty,
		}
	}

	stored, err := json.Marshal(scores)
	if err != nil {
		return SaveRecordOutcomesParams{}, err
	}

	undo, err := encodeUndo(rec.Undo)

	return SaveRecordOutcomesParams{
		BooksID: rec.BooksID,
		ID:      rec.ID,
		BatchID: rec.BatchID,
		State:   string(rec.State),
		TransactionID: uuid.NullUUID{
			UUID:  rec.TransactionID,
			Valid: rec.TransactionID != uuid.Nil,
		},
		Candidates:      candidates,
		ReviewReason:    optional(rec.ReviewReason),
		CandidateScores: stored,
		Decision: optional(
			string(rec.Decision),
		),
		DecisionUndo:   undo,
		SummaryBatchID: nullableID(rec.SummaryBatchID),
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

	return pgx.BeginFunc(
		ctx,
		r.pool,
		func(tx pgx.Tx) error { return saveOutcomes(ctx, r.q.WithTx(tx), recs) },
	)
}

func (r *Repository) TransferReviews(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	amount int64,
	currency string,
	from, to time.Time,
) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListTransferReviews(ctx, ListTransferReviewsParams{
		BooksID:   booksID,
		AccountID: accountID,
		Amount:    amount,
		Currency:  currency,
		FromDate:  from,
		ToDate:    to,
	})
	if err != nil {
		return nil, err
	}

	out := make([]domain.ExternalRecord, len(rows))
	for i, row := range rows {
		if out[i], err = toRecord(row); err != nil {
			return nil, err
		}
	}

	return out, nil
}

func (r *Repository) RecordCounterparties(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) (map[uuid.UUID]string, error) {
	rows, err := r.q.ListRecordCounterparties(
		ctx,
		ListRecordCounterpartiesParams{BooksID: booksID, Ids: ids},
	)
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		out[row.ID] = row.Counterparty
	}

	return out, nil
}

func (r *Repository) Record(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.ExternalRecord, error) {
	row, err := r.q.GetRecord(ctx, GetRecordParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.ExternalRecord{}, notFound(err)
	}

	return toRecord(row)
}

func (r *Repository) Records(
	ctx context.Context,
	booksID int64,
	batchID uuid.UUID,
	state domain.RecordState,
	p page.Request[app.RecordKey],
) ([]domain.ExternalRecord, *app.RecordKey, error) {
	//nolint:gosec // limit is at most page.MaxLimit
	params := ListBatchRecordsParams{
		BooksID:  booksID,
		BatchID:  batchID,
		State:    optional(string(state)),
		RowLimit: int32(p.Limit + 1),
	}
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

		return q.MoveReviewCount(
			ctx,
			MoveReviewCountParams{BooksID: rec.BooksID, ID: rec.BatchID, State: string(rec.State)},
		)
	})
}

// ReopenRecord returns a discarded record to review and moves it between the batch counts; it
// reports false when the record is not discarded (A140).
func (r *Repository) ReopenRecord(
	ctx context.Context,
	booksID int64,
	id, batchID uuid.UUID,
) (bool, error) {
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
