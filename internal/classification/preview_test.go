package classification_test

import (
	"net/http"
	"testing"
)

type previewSet struct {
	Count          int      `json:"count"`
	TransactionIDs []string `json:"transaction_ids"`
}

type previewView struct {
	WouldCategorize previewSet `json:"would_categorize"`
	Conflicts       previewSet `json:"conflicts"`
}

func preview(t *testing.T, b books, body map[string]any) previewView {
	t.Helper()
	var out previewView
	b.h.MustDo(http.MethodPost, "/api/v1/rules/preview", body, http.StatusOK, &out)
	return out
}

// S78: with the S41 data, the uber rule categorizes nothing new and contradicts the Travel choice (A81).
func TestS78RulePreview(t *testing.T) {
	b := newBooks(t)
	trip := b.record(t, "2026-10-14", "UBER *TRIP", "", b.travel, 2390)
	createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	b.record(t, "2026-10-15", "UBER *EATS", "", b.uncategorized, 3100)
	dispatch(t, b.h)

	got := preview(t, b, map[string]any{"name": "Uber", "conditions": []any{contains("uber")}, "actions": []any{setCategory(b.transport)}})
	if got.WouldCategorize.Count != 0 || got.Conflicts.Count != 1 || len(got.Conflicts.TransactionIDs) != 1 || got.Conflicts.TransactionIDs[0] != trip {
		t.Fatalf("preview = %+v", got)
	}
}

// A81: an uncategorized match is counted; a transaction older than 365 days is not.
func TestRulePreviewWouldCategorize(t *testing.T) {
	b := newBooks(t)
	recent := b.record(t, "2026-10-20", "PADARIA", "", b.uncategorized, 850)
	b.record(t, "2025-11-04", "PADARIA OLD", "", b.uncategorized, 900)
	dispatch(t, b.h)

	got := preview(t, b, map[string]any{"name": "Bakery", "conditions": []any{contains("padaria")}, "actions": []any{setCategory(b.food)}})
	if got.WouldCategorize.Count != 1 || got.WouldCategorize.TransactionIDs[0] != recent || got.Conflicts.Count != 0 {
		t.Fatalf("preview = %+v", got)
	}
}

// Review Focus 3: an invalid rule answers as createRule does.
func TestRulePreviewValidation(t *testing.T) {
	b := newBooks(t)
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/rules/preview", map[string]any{
		"name": "Bad", "conditions": []any{map[string]any{"field": "description", "operator": "regex", "value": "("}}, "actions": []any{setCategory(b.food)},
	}), http.StatusUnprocessableEntity, "validation_failed", "conditions[0].value")
}
