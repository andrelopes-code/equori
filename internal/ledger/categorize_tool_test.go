package ledger_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type categorizeOut struct {
	Results []struct {
		TransactionID string `json:"transaction_id"`
		Status        string `json:"status"`
	} `json:"results"`
}

func TestCategorizeTransactionsTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	uncategorized := systemAccounts(f.h)["uncategorized_expense"]
	a := f.h.Record("2026-10-20", apitest.Posting(f.checking, -100), apitest.Posting(uncategorized, 100))
	b := f.h.Record("2026-10-21", apitest.Posting(f.checking, -200), apitest.Posting(uncategorized, 200))
	var out categorizeOut
	toolOutput(t, f.h, "categorize_transactions", map[string]any{"transaction_ids": []string{a, b}, "category_id": f.food}, &out)
	if len(out.Results) != 2 || out.Results[0].Status != "categorized" || out.Results[1].Status != "categorized" {
		t.Fatalf("results = %+v", out)
	}
	var search searchOutput
	toolOutput(t, f.h, "search_transactions", map[string]any{"account_id": f.food}, &search)
	if len(search.Transactions) != 2 {
		t.Errorf("food transactions = %d", len(search.Transactions))
	}
	var ids []string
	for i := range 51 {
		ids = append(ids, fmt.Sprintf("00000000-0000-0000-0000-%012d", i))
	}
	f.h.ExpectToolError(f.h.Tool("categorize_transactions", map[string]any{"transaction_ids": ids, "category_id": f.food}), "invalid_arguments", "transaction_ids")
	c := f.h.Record("2026-10-22", apitest.Posting(f.checking, -300), apitest.Posting(uncategorized, 300))
	toolOutput(t, f.h, "categorize_transactions", map[string]any{"transaction_ids": []string{c}, "category_id": f.salary}, &out)
	f.h.ExpectToolError(f.h.Tool("categorize_transactions", map[string]any{"transaction_ids": []string{c}, "category_id": f.checking}), "invalid_arguments", "category_id")
}

func TestCategorizeWithPayee(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	var payee struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Padaria"}, http.StatusCreated, &payee)
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -100), apitest.Posting(systemAccounts(f.h)["uncategorized_expense"], 100))
	var out categorizeOut
	toolOutput(t, f.h, "categorize_transactions", map[string]any{"transaction_ids": []string{id}, "category_id": f.food, "payee_id": payee.ID}, &out)
	var search searchOutput
	toolOutput(t, f.h, "search_transactions", map[string]any{"query": "Padaria"}, &search)
	if len(search.Transactions) != 1 || search.Transactions[0].PayeeName != "Padaria" {
		t.Errorf("search = %+v", search)
	}
}

func TestCategorizeStaleBasis(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -100), apitest.Posting(systemAccounts(f.h)["uncategorized_expense"], 100))
	args := map[string]any{"transaction_ids": []string{id}, "category_id": f.food}
	first := previewTool(t, f.h, "categorize_transactions", args)
	f.h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": "2026-10-20", "description": "fixed", "expected_version": 1, "reason": "r",
		"postings": []map[string]any{apitest.Posting(f.checking, -100), apitest.Posting(systemAccounts(f.h)["uncategorized_expense"], 100)},
	}, http.StatusOK, nil)
	second := previewTool(t, f.h, "categorize_transactions", args)
	if tool.PreviewDigest(first) == tool.PreviewDigest(second) {
		t.Error("digest did not change after the transaction changed")
	}
}

func TestCategorizeTransactionsOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	other := f.h.Login("other@example.com")
	var a, b, tx struct {
		ID string `json:"id"`
	}
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).Decode(t, &a)
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "B", "class": "expense", "currency": "BRL"}).Decode(t, &b)
	f.h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-20", "description": "x",
		"postings": []map[string]any{apitest.Posting(a.ID, -100), apitest.Posting(b.ID, 100)}}).Decode(t, &tx)
	f.h.ExpectToolError(f.h.Tool("categorize_transactions", map[string]any{"transaction_ids": []string{tx.ID}, "category_id": f.food}), "not_found", "")
}
