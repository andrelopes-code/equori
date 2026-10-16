package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
)

func nullUUID(id uuid.UUID) uuid.NullUUID { return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil} }

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func toRecord(row ClassificationCategorization) app.Record {
	rec := app.Record{
		TransactionID: row.TransactionID, UserID: row.UserID, Version: int(row.TransactionVersion), Date: row.TransactionDate,
		RuleID: row.RuleID.UUID, Corrected: row.Corrected, CategoryID: row.CategoryID.UUID, Voided: row.Voided, DecidedAt: row.DecidedAt,
	}
	if row.Method != nil {
		rec.Method = *row.Method
	}
	if row.MatchKey != nil {
		rec.MatchKey = *row.MatchKey
	}
	return rec
}

func (r *Repository) Categorization(ctx context.Context, userID int64, transactionID uuid.UUID) (app.Record, error) {
	row, err := r.q.GetCategorization(ctx, GetCategorizationParams{UserID: userID, TransactionID: transactionID})
	if err != nil {
		return app.Record{}, notFound(err)
	}
	return toRecord(row), nil
}

func (r *Repository) UpsertCategorization(ctx context.Context, rec app.Record) (bool, error) {
	n, err := r.q.UpsertCategorization(ctx, UpsertCategorizationParams{
		TransactionID: rec.TransactionID, UserID: rec.UserID, TransactionVersion: int32(rec.Version), //nolint:gosec // a small positive counter
		TransactionDate: rec.Date, Method: nullString(rec.Method), RuleID: nullUUID(rec.RuleID), Corrected: rec.Corrected,
		MatchKey: nullString(rec.MatchKey), CategoryID: nullUUID(rec.CategoryID), DecidedAt: rec.DecidedAt,
	})
	return n == 1, err
}

func (r *Repository) MarkVoided(ctx context.Context, rec app.Record) error {
	return r.q.MarkCategorizationVoided(ctx, MarkCategorizationVoidedParams{
		TransactionID: rec.TransactionID, UserID: rec.UserID, TransactionVersion: int32(rec.Version), //nolint:gosec // a small positive counter
		TransactionDate: rec.Date, DecidedAt: rec.DecidedAt,
	})
}

func (r *Repository) DeleteCategorization(ctx context.Context, userID int64, transactionID uuid.UUID, version int) error {
	return r.q.DeleteCategorization(ctx, DeleteCategorizationParams{
		UserID: userID, TransactionID: transactionID, TransactionVersion: int32(version), //nolint:gosec // a small positive counter
	})
}

func (r *Repository) PendingCategorizations(ctx context.Context, userID int64, after *app.PendingKey, limit int) ([]uuid.UUID, *app.PendingKey, error) {
	params := PendingCategorizationsParams{UserID: userID, RowLimit: int32(limit)} //nolint:gosec // a fixed page size
	if after != nil {
		params.AfterDate, params.AfterID = &after.Date, nullUUID(after.ID)
	}
	rows, err := r.q.PendingCategorizations(ctx, params)
	if err != nil || len(rows) == 0 {
		return nil, nil, err
	}
	ids := make([]uuid.UUID, len(rows))
	for i, row := range rows {
		ids[i] = row.TransactionID
	}
	if len(rows) < limit {
		return ids, nil, nil
	}
	last := rows[len(rows)-1]
	return ids, &app.PendingKey{Date: last.TransactionDate, ID: last.TransactionID}, nil
}

func (r *Repository) CountMethods(ctx context.Context, userID int64, from, to time.Time) (map[string]int, error) {
	rows, err := r.q.CountMethods(ctx, CountMethodsParams{UserID: userID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, row := range rows {
		out[row.Method] = int(row.N)
	}
	return out, nil
}
