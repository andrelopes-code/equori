package ledger_test

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type restoreOut struct {
	Results []struct {
		TransactionID string `json:"transaction_id"`
		Status        string `json:"status"`
	} `json:"results"`
}

// U5: the inverse of a correction returns the transaction to the version before it.
func TestRestoreUndoesACorrection(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record(
		"2026-10-20",
		apitest.Posting(f.checking, -12000),
		apitest.Posting(f.food, 12000),
	)
	args := map[string]any{
		"transaction_id": id, "action": "correct", "amount": "130.00", "reason": "typo",
	}

	var changed writeOut
	toolOutput(t, f.h, "change_transaction", args, &changed)

	name, inverse := inverseOf(t, f.h, "change_transaction", args, changed)
	if name != "restore_transaction" {
		t.Fatalf("inverse = %s %s", name, inverse)
	}

	p := previewTool(t, f.h, name, inverse)
	if p.Basis != id+":2" || len(p.Items) != 1 {
		t.Fatalf("preview = %+v", p)
	}

	var out restoreOut
	toolOutput(t, f.h, name, inverse, &out)

	if len(out.Results) != 1 || out.Results[0].Status != "restored" ||
		!slices.Equal(postingAmounts(t, f.h, id), []int64{-12000, 12000}) {
		t.Fatalf("restore = %+v, postings %v", out, postingAmounts(t, f.h, id))
	}

	var got getTransactionOut
	toolOutput(t, f.h, "get_transaction", map[string]any{"transaction_id": id}, &got)

	if len(got.History) != 2 || got.Transaction.Version != 3 {
		t.Fatalf("version = %d, history = %+v", got.Transaction.Version, got.History)
	}

	// U2: a version the history does not hold, and a transaction that does not exist.
	var again restoreOut
	toolOutput(t, f.h, name, map[string]any{
		"reason": "r",
		"items": []map[string]any{
			{"transaction_id": id, "version": 9},
			{"transaction_id": "00000000-0000-0000-0000-000000000001", "version": 1},
		},
	}, &again)

	if again.Results[0].Status != "version_unknown" || again.Results[1].Status != "not_found" {
		t.Fatalf("results = %+v", again)
	}

	f.h.ExpectToolError(
		f.h.Tool(name, map[string]any{
			"reason": "",
			"items":  []map[string]any{{"transaction_id": id, "version": 1}},
		}),
		"invalid_arguments",
		"reason",
	)
}

// U4: the inverse of a categorization returns each transaction to the category it held.
func TestRestoreUndoesACategorization(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	a := f.h.Record("2026-10-20", apitest.Posting(f.checking, -100), apitest.Posting(f.food, 100))
	b := f.h.Record(
		"2026-10-21",
		apitest.Posting(f.checking, -200),
		apitest.Posting(f.transport, 200),
	)
	args := map[string]any{"transaction_ids": []string{a, b}, "category_id": f.health}

	var done json.RawMessage
	toolOutput(t, f.h, "categorize_transactions", args, &done)

	name, inverse := inverseOf(t, f.h, "categorize_transactions", args, done)
	if name != "restore_transaction" {
		t.Fatalf("inverse = %s %s", name, inverse)
	}

	var out restoreOut
	toolOutput(t, f.h, name, inverse, &out)

	if len(out.Results) != 2 || out.Results[0].Status != "restored" ||
		out.Results[1].Status != "restored" {
		t.Fatalf("restore = %+v", out)
	}

	for category, want := range map[string]string{f.food: a, f.transport: b} {
		var search searchOutput
		toolOutput(t, f.h, "search_transactions", map[string]any{"account_id": category}, &search)

		if len(search.Transactions) != 1 || search.Transactions[0].ID != want {
			t.Errorf("category %s holds %+v", category, search.Transactions)
		}
	}

	// U6: an undo is not undone.
	if _, ok := f.h.Undo(name, string(inverse), string(mustJSON(t, out))); ok {
		t.Fatal("restore derives an inverse")
	}
}

// inverseOf derives the write that reverses a call from its arguments and its result.
func inverseOf(
	t *testing.T,
	h *apitest.Harness,
	name string,
	args, result any,
) (string, json.RawMessage) {
	t.Helper()

	u, ok := h.Undo(name, string(mustJSON(t, args)), string(mustJSON(t, result)))
	if !ok {
		t.Fatalf("%s derives no inverse", name)
	}

	return u.Tool, u.Arguments
}

func mustJSON(t *testing.T, v any) json.RawMessage {
	t.Helper()

	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}

	return b
}
