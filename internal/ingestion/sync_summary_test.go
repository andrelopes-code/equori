package ingestion_test

import (
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// A149: the batches of one sync run share its id; the next run has another.
func TestA149BatchesOfOneSyncShareItsID(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.sync()

	a, b := f.batches(card)[0].SyncID, f.batches(f.checking)[0].SyncID
	if a == "" || a != b {
		t.Fatalf("sync ids = %q, %q; want one non-empty id", a, b)
	}

	f.sync()

	if next := f.batches(card)[0].SyncID; next == a {
		t.Fatalf("second sync reused sync id %q", a)
	}
}

// recordID returns the id of a line's record.
func (f syncFixture) recordID(externalID string) string { //nolint:unused // used from task 2 of the sync summary plan
	f.h.T().Helper()

	return f.text(`SELECT id::text FROM ingestion_external_record WHERE external_id = $1`, externalID)
}

// text returns the one text value sql selects.
func (f syncFixture) text(sql string, args ...any) string { //nolint:unused // used from task 2 of the sync summary plan
	f.h.T().Helper()

	var out string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), sql, args...).Scan(&out); err != nil {
		f.h.T().Fatal(err)
	}

	return out
}

// decisionOf returns a line's decision, summary batch and kept mark, empty when null.
func (f syncFixture) decisionOf(externalID string) (decision, summaryBatch string, kept bool) { //nolint:unused // used from task 2 of the sync summary plan
	f.h.T().Helper()

	var d, s *string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT decision, summary_batch_id::text, kept FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&d, &s, &kept); err != nil {
		f.h.T().Fatal(err)
	}

	if d != nil {
		decision = *d
	}

	if s != nil {
		summaryBatch = *s
	}

	return decision, summaryBatch, kept
}
