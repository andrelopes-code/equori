package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A136: a card posting is provisional while no line states its bill, its statement is not
// reconciled and it is dated within 10 days before its statement's closing. Statement
// 2026-11 closes on 2026-11-03 and is due on 2026-11-10.
func TestProvisionalStatement(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	ctx, uid := t.Context(), c.h.OwnerID()

	late := c.purchase("2026-11-01", 713)
	early := c.purchase("2026-10-20", 1000)
	chosen := c.h.Record("2026-11-01", ownerStatement(apitest.Posting(c.card, -500), "2026-11"), apitest.Posting(c.food, 500))
	deferred := c.h.Record("2026-11-02", ownerStatement(apitest.Posting(c.card, -5000), "2026-12"), apitest.Posting(c.food, 5000))
	line := imported(t, c.card, "2026-11-01", -1112)
	due := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	line.DueDate = &due
	billed, err := c.h.App.Ledger.RecordImported(ctx, uid, uuid.New(), line)
	if err != nil {
		t.Fatal(err)
	}
	correctDescription(c.h, billed.String())

	got := provisionalOf(t, c.h, statements(t, c.h, c.card)["2026-11"].ID)

	want := map[string]bool{late: true, early: false, chosen: true, billed.String(): false}
	for id, w := range want {
		if p, ok := got[id]; !ok || p != w {
			t.Errorf("transaction %s: provisional = %v (listed %v), want %v", id, p, ok, w)
		}
	}
	// S178: the statement the owner chose holds after 2026-11 closes.
	if s := c.h.Transaction(deferred).Postings[0].Statement; s != "2026-12" {
		t.Errorf("chosen statement = %s, want 2026-12", s)
	}

	if r := reconcileStatement(c, "2026-11", int64(statements(t, c.h, c.card)["2026-11"].AmountDue)); r.Status != http.StatusOK {
		t.Fatalf("reconcile status = %d", r.Status)
	}

	for id, p := range provisionalOf(t, c.h, statements(t, c.h, c.card)["2026-11"].ID) {
		if p {
			t.Errorf("transaction %s provisional on a reconciled statement", id)
		}
	}
}

func ownerStatement(p map[string]any, reference string) map[string]any {
	p["statement"] = reference
	return p
}

// correctDescription corrects only the description of a transaction, sending its postings
// without their statements.
func correctDescription(h *apitest.Harness, id string) {
	tx := h.Transaction(id)
	postings := make([]map[string]any, len(tx.Postings))
	for i, p := range tx.Postings {
		postings[i] = apitest.Posting(p.AccountID, p.Amount.Amount)
	}
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": tx.Date, "description": "renamed", "postings": postings,
		"expected_version": tx.Version, "reason": "rename",
	}, http.StatusOK, nil)
}

func provisionalOf(t *testing.T, h *apitest.Harness, statementID string) map[string]bool {
	t.Helper()
	var detail struct {
		Postings []struct {
			TransactionID string `json:"transaction_id"`
			Provisional   bool   `json:"provisional"`
		} `json:"postings"`
	}
	h.MustDo(http.MethodGet, "/api/v1/statements/"+statementID, nil, http.StatusOK, &detail)
	out := map[string]bool{}
	for _, p := range detail.Postings {
		out[p.TransactionID] = p.Provisional
	}
	return out
}
