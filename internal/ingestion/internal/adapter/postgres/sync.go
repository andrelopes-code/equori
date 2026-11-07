package postgres

import (
	"context"
	"encoding/json/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func nullable(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}

	return uuid.NullUUID{UUID: *id, Valid: true}
}

func nullableID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil}
}

func (r *Repository) UpdateRecordFacts(ctx context.Context, recs []domain.ExternalRecord) error {
	if len(recs) == 0 {
		return nil
	}

	params := make([]UpdateRecordFactsParams, len(recs))
	for i, rec := range recs {
		raw, err := json.Marshal(rec.Raw)
		if err != nil {
			return err
		}

		undo, err := encodeUndo(rec.Undo)
		if err != nil {
			return err
		}

		f := factsOf(rec)
		params[i] = UpdateRecordFactsParams{
			BooksID: rec.BooksID, ID: rec.ID, Raw: raw, ExternalStatus: f.status, DueDate: f.dueDate,
			InstallmentNumber: f.number, InstallmentCount: f.count, CategoryID: f.category, BalanceAfter: f.balanceAfter,
			LineKind: f.kind, UnappliedChange: optional(rec.UnappliedChange),
			BookedOn: rec.Date, Amount: rec.Amount, ReviewReason: optional(rec.ReviewReason),
			InstitutionID: f.institution, ReportedAmount: rec.ReportedAmount, ReportedOn: rec.ReportedOn,
			Decision: optional(string(rec.Decision)), DecisionUndo: undo, SummaryBatchID: nullableID(rec.SummaryBatchID),
		}
	}

	var first error
	r.q.UpdateRecordFacts(ctx, params).Exec(func(_ int, err error) {
		if err != nil && first == nil {
			first = err
		}
	})

	return first
}

func (r *Repository) SyncedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListSyncedRecords(ctx, ListSyncedRecordsParams{BooksID: booksID, AccountID: accountID, FromDate: from, ToDate: to})
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

func (r *Repository) CreatedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListCreatedRecords(ctx, ListCreatedRecordsParams{
		BooksID: booksID, AccountID: accountID, FromDate: from, ToDate: to,
	})
	if err != nil {
		return nil, err
	}

	return toRecords(rows)
}

func (r *Repository) RepeatableRecords(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
	filesOnly bool,
) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListRepeatableRecords(ctx, ListRepeatableRecordsParams{
		BooksID: booksID, AccountID: accountID, FromDate: from, ToDate: to, FilesOnly: filesOnly,
	})
	if err != nil {
		return nil, err
	}

	return toRecords(rows)
}

func (r *Repository) GroupRecords(ctx context.Context, booksID int64, accountID, entry uuid.UUID) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListGroupRecords(ctx, ListGroupRecordsParams{BooksID: booksID, AccountID: accountID, Entry: entry})
	if err != nil {
		return nil, err
	}

	return toRecords(rows)
}

func toRecords(rows []IngestionExternalRecord) ([]domain.ExternalRecord, error) {
	out := make([]domain.ExternalRecord, len(rows))

	for i, row := range rows {
		var err error
		if out[i], err = toRecord(row); err != nil {
			return nil, err
		}
	}

	return out, nil
}

func (r *Repository) RecordsByLineIDs(ctx context.Context, booksID int64, accountID uuid.UUID, externalIDs, institutionIDs []string) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListRecordsByLineIDs(ctx, ListRecordsByLineIDsParams{
		BooksID: booksID, AccountID: accountID, ExternalIds: externalIDs, InstitutionIds: institutionIDs,
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

func (r *Repository) Reidentify(ctx context.Context, booksID int64, batchID, id uuid.UUID, externalID string, dedupKey []byte, raw map[string]string) error {
	payload, err := json.Marshal(raw)
	if err != nil {
		return err
	}

	return r.q.ReidentifyRecord(ctx, ReidentifyRecordParams{
		BooksID: booksID, ID: id, ExternalID: &externalID, DedupKey: dedupKey, Raw: payload, BatchID: batchID,
	})
}

func (r *Repository) WithdrawRecords(ctx context.Context, booksID int64, batchID uuid.UUID, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.WithdrawReviewCounts(ctx, WithdrawReviewCountsParams{BooksID: booksID, RecordIds: ids}); err != nil {
			return err
		}

		return q.WithdrawRecords(ctx, WithdrawRecordsParams{BooksID: booksID, RecordIds: ids, BatchID: batchID})
	})
}

func (r *Repository) MarkAccountSynced(ctx context.Context, a domain.ExternalAccount) error {
	params := MarkAccountSyncedParams{BooksID: a.BooksID, ID: a.ID, LastSyncedOn: a.LastSyncedOn, LastReadAt: a.LastReadAt, LastDeepReadOn: a.LastDeepReadOn}
	if a.Balance != nil {
		params.BalanceOn, params.BalanceAmount = &a.Balance.Date, &a.Balance.Amount
	}

	return r.q.MarkAccountSynced(ctx, params)
}

func (r *Repository) SaveConnectionState(ctx context.Context, c domain.Connection) error {
	return r.q.SaveConnectionState(ctx, SaveConnectionStateParams{
		BooksID: c.BooksID, ID: c.ID, ProviderStatus: c.ProviderStatus, LastItemUpdateAt: c.LastItemUpdateAt,
		NextItemUpdateAt: c.NextItemUpdateAt, LastSyncedAt: c.LastSyncedAt, LastError: optional(c.LastError),
		ConsentExpiresAt: c.ConsentExpiresAt,
	})
}

func (r *Repository) AllConnections(ctx context.Context) ([]app.ConnectionRef, error) {
	rows, err := r.q.ListAllConnections(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]app.ConnectionRef, len(rows))
	for i, row := range rows {
		out[i] = app.ConnectionRef{BooksID: row.BooksID, ID: row.ID}
	}

	return out, nil
}

func (r *Repository) InstallmentPlans(ctx context.Context, booksID int64, keys [][]byte) (map[string]uuid.UUID, error) {
	rows, err := r.q.ListInstallmentPlans(ctx, ListInstallmentPlansParams{BooksID: booksID, Keys: keys})
	if err != nil {
		return nil, err
	}

	out := make(map[string]uuid.UUID, len(rows))
	for _, row := range rows {
		out[string(row.PlanKey)] = row.PlanID
	}

	return out, nil
}

func (r *Repository) SaveInstallmentPlan(ctx context.Context, booksID int64, accountID uuid.UUID, key []byte, planID uuid.UUID) error {
	return r.q.SaveInstallmentPlan(ctx, SaveInstallmentPlanParams{BooksID: booksID, AccountID: accountID, PlanKey: key, PlanID: planID})
}

func (r *Repository) SyncRuns(ctx context.Context, booksID int64, connectionID uuid.UUID, limit int) ([]domain.SyncRun, error) {
	heads, err := r.q.ListConnectionSyncs(ctx, ListConnectionSyncsParams{
		BooksID:      booksID,
		ConnectionID: connectionID,
		RowLimit:     int32(limit), //nolint:gosec // limit is domain.SyncRunsListed
	})
	if err != nil || len(heads) == 0 {
		return nil, err
	}

	syncIDs := make([]uuid.UUID, len(heads))
	index := make(map[uuid.UUID]int, len(heads))

	runs := make([]domain.SyncRun, len(heads))
	for i, h := range heads {
		syncIDs[i] = h.SyncID
		index[h.SyncID] = i
		runs[i] = domain.SyncRun{ID: h.SyncID, StartedAt: h.StartedAt}
	}

	batchRows, err := r.q.ListSyncBatches(ctx, ListSyncBatchesParams{BooksID: booksID, SyncIds: syncIDs})
	if err != nil {
		return nil, err
	}

	var batchIDs []uuid.UUID
	for _, row := range batchRows {
		b := toBatch(row)
		runs[index[b.SyncID]].Batches = append(runs[index[b.SyncID]].Batches, b)
		batchIDs = append(batchIDs, b.ID)
	}

	owner := make(map[uuid.UUID]int, len(batchIDs))
	for i, run := range runs {
		for _, b := range run.Batches {
			owner[b.ID] = i
		}
	}

	recRows, err := r.q.ListSummaryRecords(ctx, ListSummaryRecordsParams{BooksID: booksID, BatchIds: batchIDs})
	if err != nil {
		return nil, err
	}

	for _, row := range recRows {
		rec, err := toRecord(row)
		if err != nil {
			return nil, err
		}

		runs[owner[rec.SummaryBatchID]].Records = append(runs[owner[rec.SummaryBatchID]].Records, rec)
	}

	return runs, nil
}
