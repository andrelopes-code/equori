package postgres

import (
	"context"
	"encoding/json/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

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
	Version       int               `json:"version,omitzero"`
}

// SaveUndo stores a record after the undo of its decision, moves it out of the count of left
// when it entered review, and inserts line, when not nil, as a new record in review (A148).
func (r *Repository) SaveUndo(
	ctx context.Context,
	rec domain.ExternalRecord,
	decided domain.DecisionKind,
	left domain.RecordState,
	line *domain.ExternalRecord,
) error {
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
			if err := q.MoveUndoneCount(
				ctx,
				MoveUndoneCountParams{
					BooksID:   rec.BooksID,
					ID:        rec.BatchID,
					LeftState: string(left),
					Paired:    decided == domain.DecisionPaired,
				},
			); err != nil {
				return err
			}
		}

		if line == nil {
			return nil
		}

		return insertUndoneLine(ctx, q, line)
	})
}

func undoParams(
	rec domain.ExternalRecord,
	decided domain.DecisionKind,
) (UndoRecordDecisionParams, error) {
	raw, err := json.Marshal(rec.Raw)
	if err != nil {
		return UndoRecordDecisionParams{}, err
	}

	o, err := outcome(rec)
	if err != nil {
		return UndoRecordDecisionParams{}, err
	}

	return UndoRecordDecisionParams{
		ExternalID: optional(
			rec.ExternalID,
		),
		DedupKey:        rec.DedupKey,
		Raw:             raw,
		BookedOn:        rec.Date,
		Amount:          rec.Amount,
		State:           o.State,
		TransactionID:   o.TransactionID,
		Candidates:      o.Candidates,
		CandidateScores: o.CandidateScores,
		ReviewReason:    o.ReviewReason,
		UnappliedChange: optional(rec.UnappliedChange),
		Kept:            rec.Kept,
		BooksID:         rec.BooksID,
		ID:              rec.ID,
		Decision:        string(decided),
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

	q.InsertRecords(ctx, []InsertRecordsParams{params}).
		QueryRow(func(_ int, row IngestionExternalRecord, err error) {
			inserted, insertErr = row, err
		})

	if insertErr != nil {
		return insertErr
	}

	line.ID = inserted.ID

	if err := saveOutcomes(ctx, q, []domain.ExternalRecord{*line}); err != nil {
		return err
	}

	return q.MoveUndoneCount(
		ctx,
		MoveUndoneCountParams{
			BooksID:   line.BooksID,
			ID:        line.BatchID,
			LeftState: string(domain.StateReceived),
		},
	)
}

func encodeUndo(u domain.Undo) ([]byte, error) {
	row := undoRow{
		Amount: u.Amount, State: string(u.State), ReviewReason: u.ReviewReason,
		ExternalID: u.ExternalID, DedupKey: u.DedupKey, Raw: u.Raw, Version: u.Version,
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
		ExternalID: row.ExternalID, DedupKey: row.DedupKey, Raw: row.Raw, Version: row.Version,
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
