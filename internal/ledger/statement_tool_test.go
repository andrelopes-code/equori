package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func TestGetStatementTool(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	c.purchase("2026-10-14", 5000)
	c.purchase("2026-10-15", 2550)
	id := statements(t, c.h, c.card)["2026-11"].ID
	var got struct {
		Charges tool.Money `json:"charges"`
		Lines   []struct {
			Amount tool.Money `json:"amount"`
		} `json:"lines"`
	}
	toolOutput(t, c.h, "get_statement", map[string]any{"statement_id": id}, &got)
	if got.Charges.Amount != "75.50" || len(got.Lines) != 2 {
		t.Errorf("statement = %+v", got)
	}
	c.h.ExpectToolError(c.h.Tool("get_statement", map[string]any{"statement_id": "nope"}), "invalid_arguments", "statement_id")
}

func TestGetStatementOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-25"))
	other := h.Login("other@example.com")
	var card, food struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "C", "class": "liability", "currency": "BRL", "kind": "credit_card"}).Decode(t, &card)
	h.Call(other, http.MethodPost, "/api/v1/accounts/"+card.ID+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "closing_day_assignment": "next"})
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "F", "class": "expense", "currency": "BRL"}).Decode(t, &food)
	h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-14", "description": "x", "postings": []map[string]any{apitest.Posting(card.ID, -100), apitest.Posting(food.ID, 100)}})
	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	h.Call(other, http.MethodGet, "/api/v1/accounts/"+card.ID+"/statements?from=2026-01&to=2027-12", nil).Decode(t, &list)
	if len(list.Items) == 0 {
		t.Fatal("no statements")
	}
	h.ExpectToolError(h.Tool("get_statement", map[string]any{"statement_id": list.Items[0].ID}), "not_found", "")
}
