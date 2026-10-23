package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getTransactionOut struct {
	Transaction struct {
		ID       string        `json:"id"`
		Version  int           `json:"version"`
		Postings []toolPosting `json:"postings"`
	} `json:"transaction"`
	History []struct {
		Version int    `json:"version"`
		Reason  string `json:"reason"`
	} `json:"history"`
	InstallmentPlan *struct {
		Count        int `json:"count"`
		Installments []struct {
			Number int        `json:"number"`
			Amount tool.Money `json:"amount"`
		} `json:"installments"`
	} `json:"installment_plan"`
}

func TestGetTransactionTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-20", apitest.Posting(checking, -12000), apitest.Posting(food, 12000))
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": "2026-10-20", "description": "Supermarket", "expected_version": 1, "reason": "typo",
		"postings": []map[string]any{apitest.Posting(checking, -13000), apitest.Posting(food, 13000)},
	}, http.StatusOK, nil)

	var got getTransactionOut
	toolOutput(t, h, "get_transaction", map[string]any{"transaction_id": id}, &got)
	if got.Transaction.Version != 2 || len(got.History) != 1 || got.History[0].Version != 1 || got.History[0].Reason != "typo" {
		t.Fatalf("version/history = %d %+v", got.Transaction.Version, got.History)
	}
	if p := got.Transaction.Postings; len(p) != 2 || p[0].Amount.Amount != "-130.00" || p[1].Amount.Amount != "130.00" {
		t.Errorf("postings = %+v", p)
	}
	h.ExpectToolError(h.Tool("get_transaction", map[string]any{"transaction_id": "nope"}), "invalid_arguments", "transaction_id")
}

func TestGetTransactionInstallments(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	res := installmentPurchase(t, c.h, map[string]any{
		"card_account_id": c.card, "date": "2026-10-20",
		"splits": []map[string]any{{"account_id": c.food, "amount": apitest.BRL(30000)}}, "installment_count": 3,
	})
	var got getTransactionOut
	toolOutput(t, c.h, "get_transaction", map[string]any{"transaction_id": res.Transaction.ID}, &got)
	if got.InstallmentPlan == nil || got.InstallmentPlan.Count != 3 || len(got.InstallmentPlan.Installments) != 3 {
		t.Fatalf("plan = %+v", got.InstallmentPlan)
	}
	for _, i := range got.InstallmentPlan.Installments {
		if i.Amount.Amount != "100.00" {
			t.Errorf("installment %d = %s", i.Number, i.Amount)
		}
	}
}

func TestGetTransactionOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	other := h.Login("other@example.com")
	var a, b, tx struct {
		ID string `json:"id"`
	}
	for name, out := range map[string]*struct {
		ID string `json:"id"`
	}{"A": &a, "B": &b} {
		h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": name, "class": "asset", "currency": "BRL", "kind": "checking"}).Decode(t, out)
	}
	h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-20", "description": "x", "postings": []map[string]any{apitest.Posting(a.ID, -100), apitest.Posting(b.ID, 100)},
	}).Decode(t, &tx)
	h.ExpectToolError(h.Tool("get_transaction", map[string]any{"transaction_id": tx.ID}), "not_found", "")
}
