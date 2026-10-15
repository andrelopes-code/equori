package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestBillingCycleRules(t *testing.T) {
	h := apitest.New(t)
	card := h.Account("Itaú Visa", "liability", "credit_card", nil)

	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2026-12", "closing_day": 15, "due_day": 22}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "closing_day_assignment": "closing"}, http.StatusCreated, nil)

	var rules struct {
		Items []struct {
			EffectiveFrom        string `json:"effective_from"`
			ClosingDay           int    `json:"closing_day"`
			ClosingDayAssignment string `json:"closing_day_assignment"`
			DueDateAdjustment    string `json:"due_date_adjustment"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/billing-cycle-rules", nil, http.StatusOK, &rules)
	if len(rules.Items) != 2 || rules.Items[0].EffectiveFrom != "2026-01" || rules.Items[0].ClosingDayAssignment != "closing" ||
		rules.Items[1].ClosingDay != 15 || rules.Items[1].DueDateAdjustment != "following" {
		t.Fatalf("rules = %+v", rules.Items)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2026-12", "closing_day": 5, "due_day": 12}), http.StatusUnprocessableEntity, "validation_failed", "effective_from")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2027-01", "closing_day": 0, "due_day": 12}), http.StatusBadRequest, "invalid_request", "closing_day")
}

func TestCardProfileOnlyForCards(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+checking+"/billing-cycle-rules",
		map[string]any{"effective_from": "2026-01", "closing_day": 3, "due_day": 10}), http.StatusUnprocessableEntity, "validation_failed", "account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+checking+"/cards",
		map[string]any{"holder": "Owner", "last_four": "4021"}), http.StatusUnprocessableEntity, "validation_failed", "account_id")
}

func TestCreditLimitAndAvailableLimit(t *testing.T) {
	h := apitest.New(t)
	card := h.Account("Itaú Visa", "liability", "credit_card", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/credit-limits",
		map[string]any{"effective_from": "2026-01-01", "amount": apitest.BRL(1000000)}, http.StatusCreated, nil)

	var acc struct {
		Card struct {
			CreditLimit struct {
				Amount int64 `json:"amount"`
			} `json:"credit_limit"`
			AvailableLimit struct {
				Amount int64 `json:"amount"`
			} `json:"available_limit"`
		} `json:"card"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &acc)
	if acc.Card.CreditLimit.Amount != 1000000 || acc.Card.AvailableLimit.Amount != 1000000 {
		t.Fatalf("card = %+v", acc.Card)
	}
}

func TestCards(t *testing.T) {
	h := apitest.New(t)
	card := h.Account("Itaú Visa", "liability", "credit_card", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/cards", map[string]any{"holder": "Owner", "last_four": "4021", "virtual": true}, http.StatusCreated, nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+card+"/cards", map[string]any{"holder": "Owner", "last_four": "40a1"}),
		http.StatusBadRequest, "invalid_request", "last_four")
	var cards struct {
		Items []struct {
			LastFour string `json:"last_four"`
			Virtual  bool   `json:"virtual"`
			Active   bool   `json:"active"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/cards", nil, http.StatusOK, &cards)
	if len(cards.Items) != 1 || cards.Items[0].LastFour != "4021" || !cards.Items[0].Virtual || !cards.Items[0].Active {
		t.Fatalf("cards = %+v", cards.Items)
	}
}

func TestBillingRuleUnknownCalendarIs422(t *testing.T) {
	h := apitest.New(t)
	card := h.Account("Itaú Visa", "liability", "credit_card", nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "calendar": "mars"}), http.StatusUnprocessableEntity, "validation_failed", "calendar")
}
