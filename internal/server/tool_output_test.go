package server_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// outputBudget is the largest result, in bytes, that a read tool returns with default arguments
// over data shaped like the evaluation seed (spec 7.4): names and descriptions of its lengths.
const outputBudget = 8192

func TestToolOutputBudget(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	var categories []string
	for i := range 24 {
		categories = append(categories, h.Account(fmt.Sprintf("Supermarket %02d", i), "expense", "", nil))
	}
	var payees []string
	for i := range 10 {
		var p struct {
			ID string `json:"id"`
		}
		h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": fmt.Sprintf("Pão de Açúcar %02d", i)}, http.StatusCreated, &p)
		payees = append(payees, p.ID)
	}
	var first string
	for i := range 60 {
		month := 9 + i%2
		var tx struct {
			ID string `json:"id"`
		}
		h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
			"date": fmt.Sprintf("2026-%02d-%02d", month, 1+i%28), "description": fmt.Sprintf("Mercado semana %02d", i),
			"payee_id": payees[i%len(payees)],
			"postings": []any{apitest.Posting(checking, -int64(10000+i)), apitest.Posting(categories[i%len(categories)], int64(10000+i))},
		}, http.StatusCreated, &tx)
		id := tx.ID
		if first == "" {
			first = id
		}
	}

	h.Dispatch()

	tests := []struct {
		tool string
		args map[string]any
	}{
		{"list_accounts", map[string]any{}},
		{"get_balances", map[string]any{}},
		{"search_transactions", map[string]any{}},
		{"get_category_totals", map[string]any{"class": "expense", "from": "2026-09-01", "to": "2026-10-31"}},
		{"list_payees_and_tags", map[string]any{"kind": "payees"}},
		{"get_transaction", map[string]any{"transaction_id": first}},
		{"get_account_details", map[string]any{"account_id": checking}},
		{"get_account_history", map[string]any{"account_id": checking, "view": "balances", "from": "2026-09-01", "to": "2026-10-30"}},
	}
	for _, tt := range tests {
		r := h.Tool(tt.tool, tt.args)
		if r.IsError {
			t.Errorf("%s = error %s", tt.tool, r.Content)
			continue
		}
		t.Logf("%s: %d bytes", tt.tool, len(r.Content))
		if len(r.Content) > outputBudget {
			t.Errorf("%s returned %d bytes, budget %d", tt.tool, len(r.Content), outputBudget)
		}
	}
}
