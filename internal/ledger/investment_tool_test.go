package ledger_test

import (
	"testing"
)

type investmentOut struct {
	TransactionID string `json:"transaction_id"`
}

// TestRecordInvestmentBuyS21 follows the purchase of S21: 150 MXRF11 at 10.05 plus 4.90 fees.
func TestRecordInvestmentBuyS21(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := map[string]any{"kind": "buy", "account_id": f.mxrf11, "cash_account_id": f.cash, "date": "2026-10-05", "quantity": "150", "unit_price": "10.05", "fees": "4.90"}
	p := previewTool(t, f.h, "record_investment", args)
	if p.Target != "XP MXRF11" || p.Changes[0].After.Text != "MXRF11" || p.Changes[1].After.Text != "150" || p.Changes[2].After.Text != "10.05" || p.Changes[3].After.Amount != "4.90" {
		t.Fatalf("preview = %+v", p)
	}
	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)
	got := amountsByAccount(f.h.Transaction(out.TransactionID))
	if got[f.cash] != -151240 || got[f.mxrf11] != 150 {
		t.Fatalf("postings = %v", got)
	}
	sell := map[string]any{"kind": "sell", "account_id": f.mxrf11, "cash_account_id": f.cash, "date": "2026-10-20", "quantity": "50", "unit_price": "10.80", "fees": "2.10"}
	toolOutput(t, f.h, "record_investment", sell, &out)
	if got := amountsByAccount(f.h.Transaction(out.TransactionID)); got[f.cash] != 53790 || got[f.mxrf11] != -50 {
		t.Fatalf("sale postings = %v", got)
	}
}

func TestRecordInvestmentInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	base := map[string]any{"kind": "buy", "account_id": f.mxrf11, "cash_account_id": f.cash, "date": "2026-10-05"}
	with := func(extra map[string]any) map[string]any {
		m := map[string]any{}
		for k, v := range base {
			m[k] = v
		}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}
	f.h.ExpectToolError(f.h.Tool("record_investment", with(map[string]any{"unit_price": "10"})), "invalid_arguments", "quantity")
	f.h.ExpectToolError(f.h.Tool("record_investment", with(map[string]any{"quantity": "1", "unit_price": "x"})), "invalid_arguments", "unit_price")
	f.h.ExpectToolError(f.h.Tool("record_investment", with(map[string]any{"quantity": "1", "unit_price": "1", "gross": "1.00"})), "invalid_arguments", "gross")
}

// TestRecordInvestmentIncomeS22 follows the dividend of S22.
func TestRecordInvestmentIncomeS22(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	args := map[string]any{"kind": "income", "account_id": f.mxrf11, "cash_account_id": f.cash, "date": "2026-10-26", "gross": "10.00", "income_type": "dividend", "category_id": f.dividends}
	p := previewTool(t, f.h, "record_investment", args)
	if p.Changes[1].After.Amount != "10.00" {
		t.Fatalf("preview = %+v", p)
	}
	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)
	got := amountsByAccount(f.h.Transaction(out.TransactionID))
	if got[f.cash] != 1000 || got[f.dividends] != -1000 {
		t.Fatalf("postings = %v", got)
	}
}

func TestRecordInvestmentOtherUser(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	foreign := otherUserAccount(t, f.h, "Foreign", "asset", "checking")
	f.h.ExpectToolError(f.h.Tool("record_investment", map[string]any{"kind": "buy", "account_id": foreign, "cash_account_id": f.cash, "date": "2026-10-05", "quantity": "1", "unit_price": "1"}), "not_found", "")
}
