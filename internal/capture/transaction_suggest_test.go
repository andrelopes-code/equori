package capture_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type transactionSuggestionsView struct {
	Available bool `json:"available"`
	Items     []struct {
		TransactionID string `json:"transaction_id"`
		CategoryID    string `json:"category_id"`
		Source        string `json:"source"`
	} `json:"items"`
}

const suggestTransactionsPath = "/api/v1/transactions/category-suggestions"

func (b books) uncategorized(t *testing.T, description, class string, amount int64) string {
	t.Helper()
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	var category string
	for _, a := range accounts.Items {
		if a.SystemRole == "uncategorized_"+class {
			category = a.ID
		}
	}
	if class == "income" {
		amount = -amount
	}
	var out struct {
		ID string `json:"id"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-10", "description": description,
		"postings": []map[string]any{apitest.Posting(b.checking, -amount), apitest.Posting(category, amount)},
	}, http.StatusCreated, &out)
	return out.ID
}

// ADR 014 L1a: an existing uncategorized transaction is asked like a capture line, a number
// outside the list is no suggestion, and nothing is recorded.
func TestSuggestTransactionCategories(t *testing.T) {
	t.Parallel()
	provider := llmtest.New("aistudio",
		answer(`{"items":[{"description":1,"category":1},{"description":2,"category":9}]}`),
	)
	b := newBooks(t, apitest.LLM(provider))
	bakery := b.uncategorized(t, "Padaria São João", "expense", 1200)
	freelance := b.uncategorized(t, "Freela", "income", 50000)

	var got transactionSuggestionsView
	b.h.MustDo(http.MethodPost, suggestTransactionsPath, map[string]any{"transaction_ids": []string{bakery, freelance}}, http.StatusOK, &got)
	if !got.Available || len(got.Items) != 2 ||
		got.Items[0].TransactionID != bakery || got.Items[0].CategoryID != b.supermarket || got.Items[0].Source != "model" ||
		got.Items[1].TransactionID != freelance || got.Items[1].CategoryID != "" || got.Items[1].Source != "" {
		t.Fatalf("suggestions = %+v", got)
	}
	if n := len(provider.Requests()); n != 1 {
		t.Fatalf("calls = %d, want 1", n)
	}
	if tx := b.h.Transaction(bakery); tx.Version != 1 {
		t.Errorf("version = %d, want 1: a suggestion records nothing", tx.Version)
	}
}

func TestSuggestTransactionCategoriesRejects(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	categorized := b.h.Record("2026-10-10", apitest.Posting(b.checking, -900), apitest.Posting(b.transport, 900))
	b.h.ExpectProblem(b.h.Do(http.MethodPost, suggestTransactionsPath, map[string]any{"transaction_ids": []string{categorized}}),
		http.StatusUnprocessableEntity, "transaction_not_uncategorized", "transaction_ids")
	b.h.ExpectProblem(b.h.Do(http.MethodPost, suggestTransactionsPath, map[string]any{"transaction_ids": []string{"0198f0a1-0000-7000-8000-000000000001"}}),
		http.StatusNotFound, "not_found", "")

	ids := make([]string, 51)
	for i := range ids {
		ids[i] = categorized
	}
	b.h.ExpectProblem(b.h.Do(http.MethodPost, suggestTransactionsPath, map[string]any{"transaction_ids": ids}),
		http.StatusBadRequest, "invalid_request", "transaction_ids")
}

// Without a language model the answer is that of the capture: 200 and available false.
func TestSuggestTransactionCategoriesWithoutModel(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	id := b.uncategorized(t, "Padaria", "expense", 1200)
	var got transactionSuggestionsView
	b.h.MustDo(http.MethodPost, suggestTransactionsPath, map[string]any{"transaction_ids": []string{id}}, http.StatusOK, &got)
	if got.Available || len(got.Items) != 1 || got.Items[0].TransactionID != id || got.Items[0].CategoryID != "" {
		t.Fatalf("suggestions = %+v", got)
	}
}
