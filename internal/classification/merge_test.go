package classification_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func (b books) mergeCategory(t *testing.T, from, into string) {
	t.Helper()
	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+from+"/merge", map[string]string{"into": into}, http.StatusOK, nil)
	dispatch(t, b.h)
}

func ruleByName(t *testing.T, h *apitest.Harness, name string) ruleView {
	t.Helper()
	var out struct {
		Items []ruleView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/rules", nil, http.StatusOK, &out)
	for _, r := range out.Items {
		if r.Name == name {
			return r
		}
	}
	t.Fatalf("rule %q not found in %+v", name, out.Items)
	return ruleView{}
}

// A75: a merged transaction keeps its method; rule actions name the destination.
func TestMergeKeepsMethodAndRepointsRules(t *testing.T) {
	b := newBooks(t)
	tx := b.record(t, "2026-10-10", "Hotel", "", b.travel, 5000)
	createRule(t, b.h, "Trips", []map[string]any{contains("trip")}, []map[string]any{setCategory(b.travel)})
	createRule(t, b.h, "Shared", []map[string]any{contains("shared")}, []map[string]any{{"type": "split", "parts": []any{
		map[string]any{"category_id": b.travel, "percent": 5000},
		map[string]any{"category_id": b.food, "remainder": true},
	}}})
	dispatch(t, b.h)

	b.mergeCategory(t, b.travel, b.transport)

	if c := categorizationOf(t, b.h, tx); method(c) != "manual" {
		t.Fatalf("categorization after merge = %+v", c)
	}
	var version int
	if err := b.h.Pool.QueryRow(t.Context(), `SELECT transaction_version FROM classification_categorization WHERE transaction_id = $1`, tx).Scan(&version); err != nil || version != 2 {
		t.Fatalf("categorization version = %d, %v; want the merge version 2", version, err)
	}
	if got := ruleByName(t, b.h, "Trips").Actions[0]["category_id"]; got != b.transport {
		t.Fatalf("Trips action category = %v", got)
	}
	parts := ruleByName(t, b.h, "Shared").Actions[0]["parts"].([]any)
	if got := parts[0].(map[string]any)["category_id"]; got != b.transport {
		t.Fatalf("Shared first part category = %v", got)
	}
}

// A75, Review Focus 4: source mappings follow the merge; of two suggestions that collide,
// the older stays.
func TestMergeRepointsSourceCategoryAndSuggestions(t *testing.T) {
	b := newBooks(t)
	if _, err := b.h.Pool.Exec(t.Context(), `INSERT INTO classification_source_category (user_id, provider, external_id, name, category_id)
		VALUES ($1, 'pluggy', '05010000', 'Travel', $2)`, b.h.OwnerID(), b.travel); err != nil {
		t.Fatal(err)
	}
	var payee struct {
		ID string `json:"id"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Azul"}, http.StatusCreated, &payee)
	correct := func(date, category string) {
		tx := b.record(t, date, "Azul", payee.ID, b.uncategorized, 1000)
		dispatch(t, b.h)
		b.categorize(t, tx, b.h.Transaction(tx).Version, category, 1000)
		dispatch(t, b.h)
	}
	correct("2026-10-01", b.travel)
	correct("2026-10-02", b.travel)
	older := suggestions(t, b.h, "pending")
	correct("2026-10-03", b.transport)
	correct("2026-10-04", b.transport)
	if len(older) != 1 || len(suggestions(t, b.h, "pending")) != 2 {
		t.Fatalf("suggestions before merge: %+v", suggestions(t, b.h, "pending"))
	}

	b.mergeCategory(t, b.travel, b.transport)

	left := suggestions(t, b.h, "pending")
	if len(left) != 1 || left[0].ID != older[0].ID || left[0].Actions[0]["category_id"] != b.transport {
		t.Fatalf("suggestions after merge = %+v, want only %s naming transport", left, older[0].ID)
	}
	var mapped string
	if err := b.h.Pool.QueryRow(t.Context(), `SELECT category_id::text FROM classification_source_category WHERE external_id = '05010000'`).Scan(&mapped); err != nil || mapped != b.transport {
		t.Fatalf("source category = %q, %v", mapped, err)
	}
}

// S74: merging Travel into Transport moves the transaction, the rule and the budget (A75).
func TestS74MergeCategories(t *testing.T) {
	b := newBooks(t)
	trip := b.record(t, "2026-10-14", "UBER *TRIP", "", b.travel, 2390)
	createRule(t, b.h, "Trips", []map[string]any{contains("trip")}, []map[string]any{setCategory(b.travel)})
	b.h.MustDo(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id": b.travel, "amount": apitest.BRL(50000), "effective_from": "2026-10", "rollover": false,
	}, http.StatusCreated, nil)
	dispatch(t, b.h)

	b.mergeCategory(t, b.travel, b.transport)

	if version, postings := categoryOf(t, b.h, trip); version != 2 || postings[b.transport] != 2390 || postings[b.travel] != 0 {
		t.Fatalf("trip version %d, postings %v", version, postings)
	}
	if c := categorizationOf(t, b.h, trip); method(c) != "manual" {
		t.Fatalf("trip categorization = %+v", c)
	}
	if got := ruleByName(t, b.h, "Trips").Actions[0]["category_id"]; got != b.transport {
		t.Fatalf("rule category = %v", got)
	}
	var travel struct {
		ClosedOn string `json:"closed_on"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/accounts/"+b.travel, nil, http.StatusOK, &travel)
	if travel.ClosedOn != "2026-11-05" {
		t.Fatalf("travel closed_on = %q", travel.ClosedOn)
	}
	var budgets struct {
		Items []struct {
			CategoryID string `json:"category_id"`
		} `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &budgets)
	if len(budgets.Items) != 1 || budgets.Items[0].CategoryID != b.transport {
		t.Fatalf("budgets = %+v", budgets.Items)
	}
}
