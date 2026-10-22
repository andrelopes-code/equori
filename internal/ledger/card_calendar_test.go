package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestCardCalendarFromRegion(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-04-05"))
	de := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")

	dueDate := func(c *http.Client, card string) string {
		t.Helper()
		r := h.Call(c, http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-04&to=2026-04", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("statements status = %d: %s", r.Status, r.Body)
		}
		var out struct {
			Items []struct {
				Reference string `json:"reference"`
				DueDate   string `json:"due_date"`
			} `json:"items"`
		}
		r.Decode(t, &out)
		if len(out.Items) != 1 || out.Items[0].Reference != "2026-04" {
			t.Fatalf("statements = %+v", out.Items)
		}
		return out.Items[0].DueDate
	}
	charge := func(c *http.Client, card, currency string) {
		t.Helper()
		r := h.Call(c, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Food", "class": "expense", "currency": currency})
		if r.Status != http.StatusCreated {
			t.Fatalf("expense status = %d: %s", r.Status, r.Body)
		}
		var food struct {
			ID string `json:"id"`
		}
		r.Decode(t, &food)
		m := func(amount int64) map[string]any { return map[string]any{"amount": amount, "currency": currency} }
		r = h.Call(c, http.MethodPost, "/api/v1/transactions", map[string]any{
			"date": "2026-04-05", "description": "lunch",
			"postings": []map[string]any{{"account_id": food.ID, "amount": m(1000)}, {"account_id": card, "amount": m(-1000)}},
		})
		if r.Status != http.StatusCreated {
			t.Fatalf("transaction status = %d: %s", r.Status, r.Body)
		}
	}
	newCard := func(c *http.Client, currency string) string {
		t.Helper()
		r := h.Call(c, http.MethodPost, "/api/v1/accounts", map[string]any{
			"name": "Card", "class": "liability", "kind": "credit_card", "currency": currency,
		})
		if r.Status != http.StatusCreated {
			t.Fatalf("account status = %d: %s", r.Status, r.Body)
		}
		var a struct {
			ID string `json:"id"`
		}
		r.Decode(t, &a)
		r = h.Call(c, http.MethodPost, "/api/v1/accounts/"+a.ID+"/billing-cycle-rules", map[string]any{
			"effective_from": "2026-01", "closing_day": 10, "due_day": 21, "closing_day_assignment": "next",
		})
		if r.Status != http.StatusCreated {
			t.Fatalf("rule status = %d: %s", r.Status, r.Body)
		}
		charge(c, a.ID, currency)
		return a.ID
	}

	brCard := newCard(h.Client, "BRL")
	deCard := newCard(de, "EUR")

	if got := dueDate(h.Client, brCard); got != "2026-04-22" {
		t.Fatalf("BR due date = %s, want 2026-04-22", got)
	}
	if got := dueDate(de, deCard); got != "2026-04-21" {
		t.Fatalf("DE due date = %s, want 2026-04-21", got)
	}

	// Review Focus 1: a region change keeps the calendar of existing cards.
	if r := h.Call(de, http.MethodPatch, "/api/v1/me", map[string]string{"region": "BR"}); r.Status != http.StatusOK {
		t.Fatalf("patch me status = %d: %s", r.Status, r.Body)
	}
	if got := dueDate(de, deCard); got != "2026-04-21" {
		t.Fatalf("DE due date after region change = %s, want 2026-04-21", got)
	}

	r := h.Call(h.Client, http.MethodPost, "/api/v1/accounts/"+brCard+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-06", "closing_day": 10, "due_day": 21, "calendar": "xx_yy",
	})
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "calendar")
}
