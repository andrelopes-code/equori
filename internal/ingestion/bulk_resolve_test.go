package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const bulkResolvePath = "/api/v1/external-records/resolve"

type bulkResolution struct {
	RecordID string `json:"record_id"`
	Status   string `json:"status"`
}

// S289 (A201)
func TestS289BulkResolve(t *testing.T) {
	t.Parallel()
	h, batch, record, _, second := ambiguous(t)
	unknown := "01a15600-0000-7000-8000-000000000000"

	got := bulkResolve(t, h,
		map[string]any{"record_id": record.ID, "resolution": map[string]any{"action": "match", "transaction_id": second}},
		map[string]any{"record_id": unknown, "resolution": map[string]any{"action": "discard"}},
	)

	want := []bulkResolution{{record.ID, "resolved"}, {unknown, "not_found"}}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("step 1 results = %+v, want %+v", got, want)
	}

	if matched := records(t, h, batch, "matched"); len(matched) != 1 || matched[0].TransactionID != second {
		t.Fatalf("matched records = %+v", matched)
	}

	var b batchView
	h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch, nil, http.StatusOK, &b)

	if c := counts(b); c != "received 1 ignored 0 matched 1 created 0 review 0" {
		t.Fatalf("batch after step 1: %s", c)
	}

	got = bulkResolve(t, h, map[string]any{"record_id": record.ID, "resolution": map[string]any{"action": "discard"}})

	if len(got) != 1 || got[0] != (bulkResolution{record.ID, "record_resolved"}) {
		t.Fatalf("step 2 results = %+v", got)
	}

	h2, batch2, record2, first2, _ := ambiguous(t)
	tx := h2.Transaction(first2)
	stranger := h2.Record("2026-10-10", apitest.Posting(tx.Postings[0].AccountID, -1), apitest.Posting(tx.Postings[1].AccountID, 1))

	got = bulkResolve(t, h2, map[string]any{"record_id": record2.ID, "resolution": map[string]any{"action": "match", "transaction_id": stranger}})

	if len(got) != 1 || got[0] != (bulkResolution{record2.ID, "validation_failed"}) {
		t.Fatalf("step 3 results = %+v", got)
	}

	if queued := records(t, h2, batch2, "needs_review"); len(queued) != 1 {
		t.Fatalf("review queue after a refused item = %+v", queued)
	}
}

// S290 (A201)
func TestS290BulkResolveRepeatedRecord(t *testing.T) {
	t.Parallel()
	h, batch, record, _, _ := ambiguous(t)

	r := h.Do(http.MethodPost, bulkResolvePath, map[string]any{"items": []map[string]any{
		{"record_id": record.ID, "resolution": map[string]any{"action": "discard"}},
		{"record_id": record.ID, "resolution": map[string]any{"action": "create"}},
	}})

	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "items")

	if queued := records(t, h, batch, "needs_review"); len(queued) != 1 {
		t.Fatalf("review queue = %+v, want the record untouched", queued)
	}
}

func TestBulkResolveAnotherUsersRecordIsNotFound(t *testing.T) {
	t.Parallel()
	h, _, record, _, _ := ambiguous(t)
	other := h.Login("other@example.com")

	r := h.Call(other, http.MethodPost, bulkResolvePath, map[string]any{"items": []map[string]any{
		{"record_id": record.ID, "resolution": map[string]any{"action": "discard"}},
	}})

	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var out struct {
		Results []bulkResolution `json:"results"`
	}
	r.Decode(t, &out)

	if len(out.Results) != 1 || out.Results[0] != (bulkResolution{record.ID, "not_found"}) {
		t.Fatalf("results = %+v", out.Results)
	}
}

func bulkResolve(t *testing.T, h *apitest.Harness, items ...map[string]any) []bulkResolution {
	t.Helper()

	var out struct {
		Results []bulkResolution `json:"results"`
	}
	h.MustDo(http.MethodPost, bulkResolvePath, map[string]any{"items": items}, http.StatusOK, &out)

	return out.Results
}
