package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type cardOut struct {
	AccountID string `json:"account_id"`
	Action    string `json:"action"`
	ID        string `json:"id"`
}

// otherUserCardPurchase creates a card purchase owned by a second user and returns the purchase and its statement.
func otherUserCardPurchase(t *testing.T, h *apitest.Harness) (card, purchase, statement string) {
	t.Helper()
	other := h.Login("other@example.com")
	create := func(body map[string]any) string {
		var a struct {
			ID string `json:"id"`
		}
		h.Call(other, http.MethodPost, "/api/v1/accounts", body).Decode(t, &a)
		return a.ID
	}
	card = create(map[string]any{"name": "Foreign card", "class": "liability", "kind": "credit_card", "currency": "BRL"})
	h.Call(other, http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "closing_day_assignment": "next",
	})
	food := create(map[string]any{"name": "Foreign food", "class": "expense", "currency": "BRL"})
	var tx struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-14", "description": "x",
		"postings": []map[string]any{apitest.Posting(card, -1000), apitest.Posting(food, 1000)}}).Decode(t, &tx)
	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	h.Call(other, http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-01&to=2027-12", nil).Decode(t, &list)
	return card, tx.ID, list.Items[0].ID
}

func TestManageCard(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	add := map[string]any{"account_id": c.card, "action": "add_card", "holder": "Ana", "last_four": "1234", "virtual": true}
	if p := previewTool(t, c.h, "manage_card", add); p.Target != "Itaú Visa" || p.Changes[0].Field != "card" || p.Changes[0].After.Text != "Ana 1234" {
		t.Fatalf("preview = %+v", p)
	}
	var cards struct {
		Items []struct{} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &cards)
	if len(cards.Items) != 0 {
		t.Fatalf("cards after preview = %d", len(cards.Items))
	}
	var out cardOut
	toolOutput(t, c.h, "manage_card", add, &out)
	var list struct {
		Items []struct {
			ID     string `json:"id"`
			Active bool   `json:"active"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != out.ID || !list.Items[0].Active {
		t.Fatalf("cards = %+v, out = %+v", list.Items, out)
	}
	off := map[string]any{"account_id": c.card, "action": "set_card_active", "card_id": out.ID}
	if p := previewTool(t, c.h, "manage_card", off); p.Changes[0].After.Text != "Ana 1234" || p.Changes[1].Before.Text != "active" || p.Changes[1].After.Text != "inactive" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, c.h, "manage_card", off, &out)
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)
	if list.Items[0].Active {
		t.Errorf("card still active")
	}
	limit := map[string]any{"account_id": c.card, "action": "set_credit_limit", "amount": "5000.00", "effective_from": "2026-10-01"}
	if p := previewTool(t, c.h, "manage_card", limit); p.Changes[0].Field != "limit" || p.Changes[0].After.Amount != "5000.00" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, c.h, "manage_card", limit, &out)
	var limits struct {
		Items []struct {
			EffectiveFrom string `json:"effective_from"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/credit-limits", nil, http.StatusOK, &limits)
	if len(limits.Items) != 1 || limits.Items[0].EffectiveFrom != "2026-10-01" {
		t.Errorf("limits = %+v", limits.Items)
	}
	cycle := map[string]any{"account_id": c.card, "action": "set_billing_cycle", "closing_day": 5, "due_day": 15, "effective_from": "2026-12-20"}
	if p := previewTool(t, c.h, "manage_card", cycle); p.Changes[0].Field != "closing_day" || p.Changes[0].After.Text != "5" || p.Changes[1].After.Text != "15" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, c.h, "manage_card", cycle, &out)
	var rules struct {
		Items []struct {
			EffectiveFrom string `json:"effective_from"`
			ClosingDay    int    `json:"closing_day"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/billing-cycle-rules", nil, http.StatusOK, &rules)
	last := rules.Items[len(rules.Items)-1]
	if last.EffectiveFrom != "2026-12" || last.ClosingDay != 5 {
		t.Errorf("rules = %+v", rules.Items)
	}
}

func TestManageCardInvalidArguments(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.card, "action": "add_card", "holder": "Ana", "last_four": "12a4"}), "invalid_arguments", "last_four")
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.checking, "action": "add_card", "holder": "Ana", "last_four": "1234"}), "invalid_arguments", "account_id")
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.card, "action": "set_credit_limit", "effective_from": "2026-10-01"}), "invalid_arguments", "amount")
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.card, "action": "add_card", "holder": "Ana", "last_four": "1234", "amount": "1.00"}), "invalid_arguments", "amount")
}

func TestManageCardOtherUser(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	foreign, _, _ := otherUserCardPurchase(t, c.h)
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": foreign, "action": "add_card", "holder": "Ana", "last_four": "1234"}), "not_found", "")
}
