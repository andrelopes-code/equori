package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type purchaseResult struct {
	Transaction apitest.TransactionView `json:"transaction"`
	PlanID      string                  `json:"plan_id"`
}

func installmentPurchase(t *testing.T, h *apitest.Harness, body map[string]any) purchaseResult {
	t.Helper()
	var out purchaseResult
	h.MustDo(http.MethodPost, "/api/v1/installment-purchases", body, http.StatusCreated, &out)
	return out
}

func cardPostings(v apitest.TransactionView, card string) []apitest.PostingView {
	var out []apitest.PostingView
	for _, p := range v.Postings {
		if p.AccountID == card {
			out = append(out, p)
		}
	}
	return out
}

func TestInstallmentPurchaseWithoutInterest(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-25"))
	card := h.Card("Itaú Visa", 3, 10, "next")
	electronics := h.Account("Electronics", "expense", "", nil)

	res := installmentPurchase(t, h, map[string]any{
		"card_account_id": card, "date": "2026-10-20", "description": "Laptop",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	})

	cards := cardPostings(res.Transaction, card)
	want := []struct {
		amount    int64
		statement string
	}{{-33334, "2026-11"}, {-33333, "2026-12"}, {-33333, "2027-01"}}
	if len(cards) != 3 {
		t.Fatalf("card postings = %d", len(cards))
	}
	for i, w := range want {
		p := cards[i]
		if p.Amount.Amount != w.amount || p.Statement != w.statement || p.CardRole != "charge" ||
			p.Installment == nil || p.Installment.Number != i+1 || p.Installment.Count != 3 || p.Installment.PlanID != res.PlanID {
			t.Errorf("installment %d = %+v, want %d on %s", i+1, p, w.amount, w.statement)
		}
	}

	var bal struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/balance?date=2026-10-31", nil, http.StatusOK, &bal)
	if bal.Balance.Amount != -100000 {
		t.Fatalf("card balance = %d, want -100000", bal.Balance.Amount)
	}
	var commit struct {
		Amount struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/commitments?month=2026-12", nil, http.StatusOK, &commit)
	if commit.Amount.Amount != 33333 {
		t.Fatalf("committed for 2026-12 = %d, want 33333", commit.Amount.Amount)
	}
}

func TestInstallmentPurchaseWithInterest(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-25"))
	card := h.Card("Itaú Visa", 3, 10, "next")
	electronics := h.Account("Electronics", "expense", "", nil)

	res := installmentPurchase(t, h, map[string]any{
		"card_account_id": card, "date": "2026-10-25", "description": "TV",
		"splits":            []map[string]any{{"account_id": electronics, "amount": apitest.BRL(200000)}},
		"installment_count": 10, "interest": apitest.BRL(22540),
	})

	cards := cardPostings(res.Transaction, card)
	if len(cards) != 10 || cards[0].Statement != "2026-11" || cards[9].Statement != "2027-08" {
		t.Fatalf("card postings = %+v", cards)
	}
	for _, p := range cards {
		if p.Amount.Amount != -22254 {
			t.Fatalf("installment amount = %d, want -22254", p.Amount.Amount)
		}
	}
	var interest int64
	for _, p := range res.Transaction.Postings {
		if p.AccountID != card && p.AccountID != electronics {
			interest += p.Amount.Amount
		}
	}
	if interest != 22540 {
		t.Fatalf("interest postings sum = %d, want 22540", interest)
	}
}

func TestInstallmentAmountsOverride(t *testing.T) {
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	electronics := h.Account("Electronics", "expense", "", nil)
	body := map[string]any{
		"card_account_id": card, "date": "2026-10-20",
		"splits":              []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}},
		"installment_count":   3,
		"installment_amounts": []map[string]any{apitest.BRL(33333), apitest.BRL(33333), apitest.BRL(33334)},
	}
	res := installmentPurchase(t, h, body)
	if got := cardPostings(res.Transaction, card)[2].Amount.Amount; got != -33334 {
		t.Fatalf("third installment = %d, want -33334", got)
	}
	body["installment_amounts"] = []map[string]any{apitest.BRL(33333), apitest.BRL(33333), apitest.BRL(33333)}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/installment-purchases", body), http.StatusUnprocessableEntity, "validation_failed", "installment_amounts")
}

func TestRuleChangeMovesFutureStatementDates(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-25"))
	card := h.Card("Itaú Visa", 3, 10, "next")
	electronics := h.Account("Electronics", "expense", "", nil)
	installmentPurchase(t, h, map[string]any{
		"card_account_id": card, "date": "2026-10-20",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	})

	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules",
		map[string]any{"effective_from": "2027-01", "closing_day": 15, "due_day": 22}, http.StatusCreated, nil)

	ss := statements(t, h, card)
	if s := ss["2027-01"]; s.DueDate != "2027-01-22" || s.Charges != 33333 {
		t.Fatalf("2027-01 = %+v, want due 2027-01-22 with the third installment", s)
	}
	if s := ss["2026-12"]; s.DueDate != "2026-12-10" {
		t.Fatalf("2026-12 = %+v, want due 2026-12-10 under the old rule", s)
	}
}
