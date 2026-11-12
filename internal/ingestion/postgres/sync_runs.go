package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

func (r *Repository) SyncRuns(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
	limit int,
) ([]domain.SyncRun, error) {
	heads, err := r.q.ListConnectionSyncs(ctx, ListConnectionSyncsParams{
		BooksID:      booksID,
		ConnectionID: connectionID,
		//nolint:gosec // limit is domain.SyncRunsListed
		RowLimit: int32(limit),
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

	batchIDs, err := r.attachBatches(ctx, booksID, syncIDs, index, runs)
	if err != nil {
		return nil, err
	}

	if err := r.attachRecords(ctx, booksID, batchIDs, runs); err != nil {
		return nil, err
	}

	return runs, nil
}

func (r *Repository) attachBatches(
	ctx context.Context,
	booksID int64,
	syncIDs []uuid.UUID,
	index map[uuid.UUID]int,
	runs []domain.SyncRun,
) ([]uuid.UUID, error) {
	batchRows, err := r.q.ListSyncBatches(
		ctx,
		ListSyncBatchesParams{BooksID: booksID, SyncIds: syncIDs},
	)
	if err != nil {
		return nil, err
	}

	var batchIDs []uuid.UUID
	for _, row := range batchRows {
		b := toBatch(row)
		runs[index[b.SyncID]].Batches = append(runs[index[b.SyncID]].Batches, b)
		batchIDs = append(batchIDs, b.ID)
	}

	return batchIDs, nil
}

func (r *Repository) attachRecords(
	ctx context.Context,
	booksID int64,
	batchIDs []uuid.UUID,
	runs []domain.SyncRun,
) error {
	owner := make(map[uuid.UUID]int, len(batchIDs))
	for i, run := range runs {
		for _, b := range run.Batches {
			owner[b.ID] = i
		}
	}

	recRows, err := r.q.ListSummaryRecords(
		ctx,
		ListSummaryRecordsParams{BooksID: booksID, BatchIds: batchIDs},
	)
	if err != nil {
		return err
	}

	for _, row := range recRows {
		rec, err := toRecord(row)
		if err != nil {
			return err
		}

		runs[owner[rec.SummaryBatchID]].Records = append(
			runs[owner[rec.SummaryBatchID]].Records,
			rec,
		)
	}

	return nil
}
