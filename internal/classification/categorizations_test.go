package classification_test

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type categorizationItem struct {
	TransactionID string `json:"transaction_id"`
	Method        string `json:"method"`
	RuleID        string `json:"rule_id"`
}

// A79: the categorizations of several transactions in one call; a transaction without a row is absent.
func TestCategorizationsByTransaction(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	manual := b.record(t, "2026-10-10", "Hotel", "", b.travel, 5000)
	byRule := b.record(t, "2026-10-11", "UBER *TRIP", "", b.uncategorized, 2390)
	dispatch(t, b.h)
	savings := b.h.Account("Reserve", "asset", "savings", nil)
	transfer := b.h.Record("2026-10-12", map[string]any{"account_id": b.checking, "amount": map[string]any{"amount": -100, "currency": "BRL"}},
		map[string]any{"account_id": savings, "amount": map[string]any{"amount": 100, "currency": "BRL"}})
	dispatch(t, b.h)

	q := url.Values{"transaction_id": {manual, byRule, transfer}}
	var out struct {
		Items []categorizationItem `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/categorizations?"+q.Encode(), nil, http.StatusOK, &out)
	got := map[string]categorizationItem{}
	for _, it := range out.Items {
		got[it.TransactionID] = it
	}
	if len(out.Items) != 2 || got[manual].Method != "manual" || got[byRule].Method != "rule" || got[byRule].RuleID == "" {
		t.Fatalf("categorizations = %+v", out.Items)
	}
}

func TestCategorizationsLimit(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	ids := make([]string, 201)
	for i := range ids {
		ids[i] = "transaction_id=01a15600-0000-7000-8000-000000000000"
	}
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/categorizations?"+strings.Join(ids, "&"), nil), http.StatusBadRequest, "invalid_request", "transaction_id")
}

// A80: a rule reports how many current categorizations it decided and when it last did.
func TestRuleUsage(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	rule := createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	idle := createRule(t, b.h, "Idle", []map[string]any{contains("zzz")}, []map[string]any{setCategory(b.travel)})
	b.record(t, "2026-10-10", "UBER *TRIP", "", b.uncategorized, 2390)
	b.record(t, "2026-10-11", "UBER *EATS", "", b.uncategorized, 3100)
	voided := b.record(t, "2026-10-12", "UBER *X", "", b.uncategorized, 1000)
	dispatch(t, b.h)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	dispatch(t, b.h)

	var got struct {
		CategorizedCount  int    `json:"categorized_count"`
		LastCategorizedAt string `json:"last_categorized_at"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/rules/"+rule.ID, nil, http.StatusOK, &got)
	if got.CategorizedCount != 2 || got.LastCategorizedAt == "" {
		t.Fatalf("rule usage = %+v", got)
	}
	var list struct {
		Items []struct {
			ID                string  `json:"id"`
			CategorizedCount  int     `json:"categorized_count"`
			LastCategorizedAt *string `json:"last_categorized_at"`
		} `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/rules", nil, http.StatusOK, &list)
	for _, r := range list.Items {
		if r.ID == idle.ID && (r.CategorizedCount != 0 || r.LastCategorizedAt != nil) {
			t.Fatalf("idle rule = %+v", r)
		}
		if r.ID == rule.ID && r.CategorizedCount != 2 {
			t.Fatalf("listed rule = %+v", r)
		}
	}
}
