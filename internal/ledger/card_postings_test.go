package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func cardPosting(account string, amount int64, statement, role string) map[string]any {
	p := apitest.Posting(account, amount)
	if statement != "" {
		p["statement"] = statement
	}
	if role != "" {
		p["card_role"] = role
	}
	return p
}

func TestCardPurchaseStatements(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	closingCard := h.Card("Closing card", 3, 10, "closing")
	food := h.Account("Food", "expense", "", nil)

	tests := []struct {
		card, date, want string
	}{
		{card, "2026-10-14", "2026-11"},
		{card, "2026-11-03", "2026-12"},
		{card, "2026-11-02", "2026-11"},
		{closingCard, "2026-11-03", "2026-11"},
	}
	for _, tt := range tests {
		id := h.Record(tt.date, apitest.Posting(tt.card, -23000), apitest.Posting(food, 23000))
		got := h.Transaction(id).Postings[0]
		if got.Statement != tt.want || got.CardRole != "charge" {
			t.Errorf("purchase on %s: statement %q role %q, want %s charge", tt.date, got.Statement, got.CardRole, tt.want)
		}
		if p := h.Transaction(id).Postings[1]; p.Statement != "" || p.CardRole != "" {
			t.Errorf("expense posting got statement %q role %q", p.Statement, p.CardRole)
		}
	}
}

func TestExplicitStatementOverride(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-14", cardPosting(card, -1000, "2027-01", ""), apitest.Posting(food, 1000))
	if got := h.Transaction(id).Postings[0].Statement; got != "2027-01" {
		t.Fatalf("statement = %q, want 2027-01", got)
	}
}

func TestCardRoleDefaults(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	card := h.Card("Itaú Visa", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	cashback := h.Account("Cashback", "income", "", nil)
	checking := h.Account("Nubank", "asset", "checking", nil)
	h.Record("2026-10-14", apitest.Posting(card, -23000), apitest.Posting(food, 23000))

	refund := h.Transaction(h.Record("2026-10-20", apitest.Posting(card, 5000), apitest.Posting(food, -5000))).Postings[0]
	reward := h.Transaction(h.Record("2026-10-21", apitest.Posting(card, 230), apitest.Posting(cashback, -230))).Postings[0]
	pay := h.Transaction(h.Record("2026-11-05", apitest.Posting(card, 18000), apitest.Posting(checking, -18000))).Postings[0]

	if refund.CardRole != "credit" || reward.CardRole != "credit" {
		t.Fatalf("refund %q, cashback %q; want credit", refund.CardRole, reward.CardRole)
	}
	if pay.CardRole != "payment" || pay.Statement != "2026-11" {
		t.Fatalf("payment role %q statement %q; want payment on the closed statement 2026-11", pay.CardRole, pay.Statement)
	}
}

func TestCardRoleSignMustMatch(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", cardPosting(card, -100, "", "payment"), apitest.Posting(food, 100))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].card_role")
}

func TestStatementOnNonCardPostingIs422(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", cardPosting(checking, -100, "2026-11", ""), apitest.Posting(food, 100))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].statement")
}

func TestCardWithoutRuleIs422(t *testing.T) {
	h := apitest.New(t)
	card := h.Account("No rule", "liability", "credit_card", nil)
	food := h.Account("Food", "expense", "", nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", apitest.Posting(card, -100), apitest.Posting(food, 100))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].account_id")
}

func TestCorrectingDateMovesStatement(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-14", apitest.Posting(card, -100), apitest.Posting(food, 100))
	correction := tx("2026-11-04", apitest.Posting(card, -100), apitest.Posting(food, 100))
	correction["expected_version"] = 1
	correction["reason"] = "wrong date"
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, correction, http.StatusOK, nil)
	if got := h.Transaction(id).Postings[0].Statement; got != "2026-12" {
		t.Fatalf("statement after correction = %q, want 2026-12", got)
	}
}

func TestPurchaseConsumesLimit(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/credit-limits",
		map[string]any{"effective_from": "2026-01-01", "amount": apitest.BRL(1000000)}, http.StatusCreated, nil)
	h.Record("2026-10-14", apitest.Posting(card, -23000), apitest.Posting(food, 23000))
	var acc struct {
		Card struct {
			AvailableLimit struct {
				Amount int64 `json:"amount"`
			} `json:"available_limit"`
		} `json:"card"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &acc)
	if acc.Card.AvailableLimit.Amount != 977000 {
		t.Fatalf("available limit = %d, want 977000", acc.Card.AvailableLimit.Amount)
	}
}
