package ingestion_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type recordView struct {
	ID            string   `json:"id"`
	State         string   `json:"state"`
	TransactionID string   `json:"transaction_id"`
	Candidates    []string `json:"candidates"`
	Amount        struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
}

func records(t *testing.T, h *apitest.Harness, batch, state string) []recordView {
	t.Helper()
	var out struct {
		Items []recordView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch+"/records?state="+state, nil, http.StatusOK, &out)
	return out.Items
}

func resolve(h *apitest.Harness, record string, body map[string]any) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/external-records/"+record+"/resolve", body)
}

// ambiguous imports one −50.00 line against two manual −50.00 entries (S35).
func ambiguous(t *testing.T) (h *apitest.Harness, batch string, record recordView, first, second string) {
	h = apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	first = h.Record("2026-10-09", apitest.Posting(checking, -5000), apitest.Posting(food, 5000))
	second = h.Record("2026-10-10", apitest.Posting(checking, -5000), apitest.Posting(food, 5000))
	b := mustImport(t, h, checking, "ofx", "a.ofx", apitest.OFX("", apitest.OFXLine{Date: "20261010", Amount: "-50.00", FITID: "p1", Name: "PIX"}))
	if got := counts(b); got != "received 1 ignored 0 matched 0 created 0 review 1" {
		t.Fatalf("import: %s", got)
	}
	queued := records(t, h, b.ID, "needs_review")
	if len(queued) != 1 || !slices.Equal(queued[0].Candidates, []string{first, second}) || queued[0].Amount.Amount != -5000 {
		t.Fatalf("review queue = %+v", queued)
	}
	return h, b.ID, queued[0], first, second
}

// S35.
func TestResolveAsMatch(t *testing.T) {
	h, batch, record, first, second := ambiguous(t)
	h.ExpectProblem(resolve(h, record.ID, map[string]any{"action": "match"}), http.StatusUnprocessableEntity, "validation_failed", "transaction_id")
	stranger := h.Record("2026-10-10", apitest.Posting(h.Transaction(first).Postings[0].AccountID, -1), apitest.Posting(h.Transaction(first).Postings[1].AccountID, 1))
	h.ExpectProblem(resolve(h, record.ID, map[string]any{"action": "match", "transaction_id": stranger}), http.StatusUnprocessableEntity, "validation_failed", "transaction_id")

	var resolved recordView
	h.MustDo(http.MethodPost, "/api/v1/external-records/"+record.ID+"/resolve", map[string]any{"action": "match", "transaction_id": second}, http.StatusOK, &resolved)
	if resolved.State != "matched" || resolved.TransactionID != second {
		t.Fatalf("resolved = %+v", resolved)
	}
	var b batchView
	h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch, nil, http.StatusOK, &b)
	if got := counts(b); got != "received 1 ignored 0 matched 1 created 0 review 0" {
		t.Fatalf("batch after resolution: %s", got)
	}
	h.ExpectProblem(resolve(h, record.ID, map[string]any{"action": "discard"}), http.StatusConflict, "record_resolved", "")
}

func TestResolveAsCreateOrDiscard(t *testing.T) {
	for _, tc := range []struct{ action, want string }{
		{"create", "received 1 ignored 0 matched 0 created 1 review 0"},
		{"discard", "received 1 ignored 0 matched 0 created 0 review 0"},
	} {
		t.Run(tc.action, func(t *testing.T) {
			h, batch, record, _, _ := ambiguous(t)
			before := transactionCount(t, h)
			var resolved recordView
			h.MustDo(http.MethodPost, "/api/v1/external-records/"+record.ID+"/resolve", map[string]any{"action": tc.action}, http.StatusOK, &resolved)
			var b batchView
			h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch, nil, http.StatusOK, &b)
			created := map[string]int{"create": 1, "discard": 0}[tc.action]
			if got := counts(b); got != tc.want || transactionCount(t, h) != before+created {
				t.Fatalf("batch: %s, transactions %d → %d", got, before, transactionCount(t, h))
			}
		})
	}
}

func TestResolveAnotherUsersRecordIs404(t *testing.T) {
	h, _, record, _, _ := ambiguous(t)
	other := h.Login("other@example.com")
	h.ExpectProblem(h.Call(other, http.MethodPost, "/api/v1/external-records/"+record.ID+"/resolve", map[string]any{"action": "discard"}),
		http.StatusNotFound, "not_found", "")
}
