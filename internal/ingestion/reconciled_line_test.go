package ingestion_test

import (
	"net/http"
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

// S673 (A261): a line the aggregator reports for the first time, dated before the account's
// last balance reconciliation, contradicts a balance the bank reported without it; it waits
// for review instead of being booked. A line of the reconciliation's own date is booked, and
// the owner can still create the held line.
func TestS673LineBeforeReconciledBalance(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-05", "-45.90"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-10-12", "-120.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-3", "2026-10-15", "3000.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.sync()

	if n := f.count(
		`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND date = '2026-11-12'`,
		f.checking,
	); n != 1 {
		t.Fatalf("reconciliations on 2026-11-12 = %d, want 1", n)
	}

	transactions := transactionCount(t, f.h)
	f.line(pluggy.SubtypeChecking, bankLine("late-1", "2026-11-05", "4.35"))
	f.line(pluggy.SubtypeChecking, bankLine("same-1", "2026-11-12", "-10.00"))

	f.sync()

	b := f.batches(f.checking)[0]
	if b.Counts.Created != 1 || b.Counts.NeedsReview != 1 {
		t.Fatalf("batch = %+v, want created 1 and needs_review 1", b)
	}

	if state, tx := f.recordOf("late-1"); state != "needs_review" || tx != "" {
		t.Fatalf("late-1 = %s on %q, want needs_review without transaction", state, tx)
	}

	if state, tx := f.recordOf("same-1"); state != "created" || tx == "" {
		t.Fatalf("same-1 = %s on %q, want created", state, tx)
	}

	if got := transactionCount(t, f.h); got != transactions+1 {
		t.Fatalf("transactions %d → %d, want one more", transactions, got)
	}

	held := heldRecord(t, f, b.ID)
	if held.ReviewReason != "reconciled" {
		t.Fatalf("review_reason = %q, want reconciled", held.ReviewReason)
	}

	var resolved recordView
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/external-records/"+held.ID+"/resolve",
		map[string]any{"action": "create"},
		http.StatusOK,
		&resolved,
	)

	if resolved.State != "created" || transactionCount(t, f.h) != transactions+2 {
		t.Fatalf("resolved = %+v", resolved)
	}
}

type heldView struct {
	ID           string `json:"id"`
	ReviewReason string `json:"review_reason"`
}

func heldRecord(t *testing.T, f syncFixture, batch string) heldView {
	t.Helper()
	var out struct {
		Items []heldView `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/import-batches/"+batch+"/records?state=needs_review",
		nil,
		http.StatusOK,
		&out,
	)

	if len(out.Items) != 1 {
		t.Fatalf("records in review = %+v, want 1", out.Items)
	}

	return out.Items[0]
}
