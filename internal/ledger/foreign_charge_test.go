package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestForeignChargeDefaults(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-22"))
	de := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")

	create := func(c *http.Client, path string, body map[string]any, out any) {
		t.Helper()
		r := h.Call(c, http.MethodPost, path, body)
		if r.Status != http.StatusCreated {
			t.Fatalf("POST %s status = %d: %s", path, r.Status, r.Body)
		}
		r.Decode(t, out)
	}
	type idOut struct {
		ID string `json:"id"`
	}
	type cardOut struct {
		ID              string `json:"id"`
		ForeignChargeBP int    `json:"foreign_charge_bp"`
	}
	newCard := func(c *http.Client, currency string, extra map[string]any) (account string, card cardOut) {
		t.Helper()
		var a idOut
		create(c, "/api/v1/accounts", map[string]any{"name": "Card", "class": "liability", "kind": "credit_card", "currency": currency}, &a)
		body := map[string]any{"holder": "Ana", "last_four": "1234"}
		for k, v := range extra {
			body[k] = v
		}
		create(c, "/api/v1/accounts/"+a.ID+"/billing-cycle-rules", map[string]any{
			"effective_from": "2026-01", "closing_day": 10, "due_day": 21, "closing_day_assignment": "next",
		}, &struct{}{})
		create(c, "/api/v1/accounts/"+a.ID+"/cards", body, &card)
		return a.ID, card
	}
	expense := func(c *http.Client, name, currency string) string {
		t.Helper()
		var a idOut
		create(c, "/api/v1/accounts", map[string]any{"name": name, "class": "expense", "currency": currency}, &a)
		return a.ID
	}
	purchase := func(c *http.Client, body map[string]any) map[string]int64 {
		t.Helper()
		body["date"] = "2026-10-22"
		body["original"] = units(10000, "USD")
		body["rate"] = "5.0000"
		r := h.Call(c, http.MethodPost, "/api/v1/foreign-purchases", body)
		if r.Status != http.StatusCreated {
			t.Fatalf("purchase status = %d: %s", r.Status, r.Body)
		}
		var tx transactionOut
		r.Decode(t, &tx)
		got := map[string]int64{}
		for _, p := range tx.Postings {
			amount, _ := amountOf(p)
			got[p.AccountID] += amount
		}
		return got
	}

	brAccount, brCard := newCard(h.Client, "BRL", nil)
	if brCard.ForeignChargeBP != 350 {
		t.Fatalf("BR card foreign_charge_bp = %d, want 350", brCard.ForeignChargeBP)
	}
	travel := expense(h.Client, "Travel", "BRL")
	charge := expense(h.Client, "Foreign charge", "BRL")
	got := purchase(h.Client, map[string]any{"account_id": brAccount, "category_id": travel, "foreign_charge_category_id": charge})
	if len(got) != 3 || got[travel] != 50000 || got[charge] != 1750 || got[brAccount] != -51750 {
		t.Fatalf("BR purchase postings = %v", got)
	}
	got = purchase(h.Client, map[string]any{"account_id": brAccount, "category_id": travel, "foreign_charge_category_id": charge, "foreign_charge_rate_bp": 100})
	if got[charge] != 500 || got[brAccount] != -50500 {
		t.Fatalf("explicit rate postings = %v", got)
	}

	deAccount, deCard := newCard(de, "EUR", nil)
	if deCard.ForeignChargeBP != 0 {
		t.Fatalf("DE card foreign_charge_bp = %d, want 0", deCard.ForeignChargeBP)
	}
	deTravel := expense(de, "Travel", "EUR")
	got = purchase(de, map[string]any{"account_id": deAccount, "category_id": deTravel})
	if len(got) != 2 || got[deTravel] != 50000 || got[deAccount] != -50000 {
		t.Fatalf("DE purchase postings = %v", got)
	}

	// Review Focus 1: a region change keeps the foreign charge rate of existing cards.
	if r := h.Call(de, http.MethodPatch, "/api/v1/me", map[string]string{"region": "BR"}); r.Status != http.StatusOK {
		t.Fatalf("patch me status = %d: %s", r.Status, r.Body)
	}
	r := h.Call(de, http.MethodGet, "/api/v1/accounts/"+deAccount+"/cards", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("list cards status = %d: %s", r.Status, r.Body)
	}
	var list struct {
		Items []cardOut `json:"items"`
	}
	r.Decode(t, &list)
	if len(list.Items) != 1 || list.Items[0].ForeignChargeBP != 0 {
		t.Fatalf("DE cards after region change = %+v", list.Items)
	}
	got = purchase(de, map[string]any{"account_id": deAccount, "category_id": deTravel})
	if len(got) != 2 {
		t.Fatalf("DE purchase after region change = %v", got)
	}

	_, explicit := newCard(de, "EUR", map[string]any{"foreign_charge_bp": 200})
	if explicit.ForeignChargeBP != 200 {
		t.Fatalf("explicit foreign_charge_bp = %d, want 200", explicit.ForeignChargeBP)
	}
	h.ExpectProblem(h.Call(de, http.MethodPost, "/api/v1/accounts/"+deAccount+"/cards", map[string]any{"holder": "Ana", "last_four": "1234", "foreign_charge_bp": 10001}),
		http.StatusBadRequest, "invalid_request", "foreign_charge_bp")
}
