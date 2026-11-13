package ledger_test

import (
	"net/http"
	"testing"
)

// TestRecordInvestmentCorrects follows S415 and S416 through the tool (A227 IC12).
func TestRecordInvestmentCorrects(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	buy := f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	dividend := f.income(t, f.dividend("2026-10-26", 1200, 0))
	args := map[string]any{
		"kind":            "buy",
		"transaction_id":  buy.ID,
		"reason":          "price",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-05",
		"quantity":        "150",
		"unit_price":      "10.00",
		"fees":            "4.90",
	}

	p := previewTool(t, f.h, "record_investment", args)
	if p.Action != "record_investment.correct" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	var read tradeTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+buy.ID, nil, http.StatusOK, &read)

	if out.TransactionID != buy.ID || read.Version != 2 || read.Trade.UnitPrice != "10" {
		t.Fatalf("corrected trade = %s %+v %+v", out.TransactionID, read, read.Trade)
	}

	income := map[string]any{
		"kind":                 "income",
		"transaction_id":       dividend.ID,
		"reason":               "gross",
		"account_id":           f.mxrf11,
		"cash_account_id":      f.cash,
		"date":                 "2026-10-26",
		"gross":                "15.00",
		"withheld":             "1.00",
		"withheld_category_id": f.incomeTax,
		"income_type":          "dividend",
		"category_id":          f.dividends,
	}
	toolOutput(t, f.h, "record_investment", income, &out)

	if got := amountsByAccount(f.h.Transaction(dividend.ID)); got[f.cash] != 1400 ||
		got[f.incomeTax] != 100 || got[f.dividends] != -1500 {
		t.Fatalf("corrected income = %v", got)
	}

	cases := []struct {
		name, field, code string
		patch             map[string]any
	}{
		{"reason missing", "reason", "invalid_arguments", map[string]any{"reason": ""}},
		{"reason without a transaction", "reason", "invalid_arguments",
			map[string]any{"transaction_id": ""}},
		{"trade kind on an income", "", "not_found",
			map[string]any{"transaction_id": dividend.ID}},
	}
	for _, c := range cases {
		m := map[string]any{}
		for k, v := range args {
			m[k] = v
		}

		for k, v := range c.patch {
			m[k] = v
		}

		f.h.ExpectToolError(f.h.Tool("record_investment", m), c.code, c.field)
	}
}
