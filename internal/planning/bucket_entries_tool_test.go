package planning_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolEntries struct {
	Total   tool.Money `json:"total"`
	Entries []struct {
		TransactionID string     `json:"transaction_id"`
		CategoryName  string     `json:"category_name"`
		Date          string     `json:"date"`
		Kind          string     `json:"kind"`
		Amount        tool.Money `json:"amount"`
	} `json:"entries"`
}

// TestBucketEntriesToolS549 reads the entries of the bucket Needs of S549 by name, and the
// spending outside the split with the bucket none.
func TestBucketEntriesToolS549(t *testing.T) {
	t.Parallel()
	f := newEntriesFixture(t)

	var out struct {
		BucketEntries toolEntries `json:"bucket_entries"`
	}
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{
		"kind": "bucket_entries", "month": "2026-10", "bucket": "Needs",
	}, &out)

	got := out.BucketEntries
	if len(got.Entries) != 1 || got.Total.Amount != "1200.00" {
		t.Fatalf("entries = %+v, want one of 1200.00", got)
	}

	e := got.Entries[0]
	if e.Date != "2026-10-06" || e.Kind != "expense" || e.CategoryName != "Food" ||
		e.Amount.Amount != "1200.00" || e.TransactionID == "" {
		t.Errorf("entry = %+v", e)
	}

	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{
		"kind": "bucket_entries", "month": "2026-10", "bucket": "none",
	}, &out)

	if got := out.BucketEntries; len(got.Entries) != 1 || got.Total.Amount != "100.00" {
		t.Fatalf("outside = %+v, want the gym of 100.00", got)
	}

	f.h.ExpectToolError(
		f.h.Tool("get_budgets_and_goals", map[string]any{
			"kind": "bucket_entries", "month": "2026-10", "bucket": "Nope",
		}),
		"invalid_arguments",
		"bucket",
	)
	f.h.ExpectToolError(
		f.h.Tool("get_budgets_and_goals", map[string]any{"kind": "bucket_entries"}),
		"invalid_arguments",
		"bucket",
	)
}
