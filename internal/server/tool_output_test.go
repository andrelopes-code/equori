package server_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// outputBudget is the largest result, in bytes, that a read tool returns with default arguments.
const outputBudget = 8192

func TestToolOutputBudget(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Checking", "asset", "checking", nil)
	var categories []string
	for i := range 24 {
		categories = append(categories, h.Account(fmt.Sprintf("Cat %02d", i), "expense", "", nil))
	}
	for i := range 10 {
		h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": fmt.Sprintf("Payee %02d", i)}, http.StatusCreated, nil)
	}
	var first string
	for i := range 60 {
		month := 9 + i%2
		id := h.Record(fmt.Sprintf("2026-%02d-%02d", month, 1+i%28), apitest.Posting(checking, -int64(1000+i)), apitest.Posting(categories[i%len(categories)], int64(1000+i)))
		if first == "" {
			first = id
		}
	}

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
		if len(r.Content) > outputBudget {
			t.Errorf("%s returned %d bytes, budget %d", tt.tool, len(r.Content), outputBudget)
		}
	}
}
