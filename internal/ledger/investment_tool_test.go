package ledger_test

import (
	"net/http"
	"strings"
	"testing"
)

type investmentOut struct {
	TransactionID string `json:"transaction_id"`
}

// TestRecordInvestmentBuyS21 follows the purchase of S21: 150 MXRF11 at 10.05 plus 4.90 fees.
func TestRecordInvestmentBuyS21(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := map[string]any{
		"kind":            "buy",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-05",
		"quantity":        "150",
		"unit_price":      "10.05",
		"fees":            "4.90",
	}

	p := previewTool(t, f.h, "record_investment", args)
	if p.Target != "XP MXRF11" || p.Changes[0].After.Text != "MXRF11" ||
		p.Changes[1].After.Text != "150" ||
		p.Changes[2].After.Text != "10.05" ||
		p.Changes[3].After.Amount != "4.90" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	got := amountsByAccount(f.h.Transaction(out.TransactionID))
	if got[f.cash] != -151240 || got[f.mxrf11] != 150 {
		t.Fatalf("postings = %v", got)
	}

	sell := map[string]any{
		"kind":            "sell",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-20",
		"quantity":        "50",
		"unit_price":      "10.80",
		"fees":            "2.10",
	}
	toolOutput(t, f.h, "record_investment", sell, &out)

	if got := amountsByAccount(
		f.h.Transaction(out.TransactionID),
	); got[f.cash] != 53790 ||
		got[f.mxrf11] != -50 {
		t.Fatalf("sale postings = %v", got)
	}
}

func TestRecordInvestmentInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	base := map[string]any{
		"kind":            "buy",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-05",
	}
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
	f.h.ExpectToolError(
		f.h.Tool("record_investment", with(map[string]any{"unit_price": "10"})),
		"invalid_arguments",
		"quantity",
	)
	f.h.ExpectToolError(
		f.h.Tool("record_investment", with(map[string]any{"quantity": "1", "unit_price": "x"})),
		"invalid_arguments",
		"unit_price",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			"record_investment",
			with(map[string]any{"quantity": "1", "unit_price": "1", "gross": "1.00"}),
		),
		"invalid_arguments",
		"gross",
	)
}

// TestRecordInvestmentIncomeS22 follows the dividend of S22.
func TestRecordInvestmentIncomeS22(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	args := map[string]any{
		"kind":            "income",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-26",
		"gross":           "10.00",
		"income_type":     "dividend",
		"category_id":     f.dividends,
	}

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
	f.h.ExpectToolError(
		f.h.Tool(
			"record_investment",
			map[string]any{
				"kind":            "buy",
				"account_id":      foreign,
				"cash_account_id": f.cash,
				"date":            "2026-10-05",
				"quantity":        "1",
				"unit_price":      "1",
			},
		),
		"not_found",
		"",
	)
}

func TestRecordInvestmentDescriptionAndTaxCategories(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	taxes := f.h.Account("Brokerage taxes", "expense", "", nil)

	buy := map[string]any{
		"kind":            "buy",
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"date":            "2026-10-05",
		"quantity":        "10",
		"unit_price":      "10.00",
		"description":     "Second lot",
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", buy, &out)

	if tx := f.h.Transaction(out.TransactionID); tx.Description != "Second lot" {
		t.Fatalf("buy description = %q", tx.Description)
	}

	sell := map[string]any{
		"kind":              "sell",
		"account_id":        f.mxrf11,
		"cash_account_id":   f.cash,
		"date":              "2026-10-20",
		"quantity":          "5",
		"unit_price":        "12.00",
		"taxes":             "1.50",
		"taxes_category_id": taxes,
	}
	toolOutput(t, f.h, "record_investment", sell, &out)

	if got := amountsByAccount(
		f.h.Transaction(out.TransactionID),
	); got[taxes] != 150 ||
		got[f.cash] != 5850 {
		t.Fatalf("sale postings = %v", got)
	}

	f.h.ExpectToolError(f.h.Tool("record_investment", map[string]any{
		"kind":                 "buy",
		"account_id":           f.mxrf11,
		"cash_account_id":      f.cash,
		"date":                 "2026-10-05",
		"quantity":             "1",
		"unit_price":           "1",
		"withheld_category_id": taxes,
	}), "invalid_arguments", "withheld_category_id")
}

func TestRecordInvestmentIncomeDescriptionAndWithheldCategory(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	withheld := f.h.Account("Income tax", "expense", "", nil)

	args := map[string]any{
		"kind":                 "income",
		"account_id":           f.mxrf11,
		"cash_account_id":      f.cash,
		"date":                 "2026-10-26",
		"gross":                "10.00",
		"withheld":             "1.50",
		"income_type":          "dividend",
		"category_id":          f.dividends,
		"withheld_category_id": withheld,
		"description":          "October dividend",
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	tx := f.h.Transaction(out.TransactionID)
	if got := amountsByAccount(
		tx,
	); tx.Description != "October dividend" || got[withheld] != 150 ||
		got[f.cash] != 850 {
		t.Fatalf("income = %q %v", tx.Description, got)
	}
}

func TestRecordInvestmentWithBrokerageAndInstrument(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("KNRI11", "reit"),
		http.StatusCreated,
		nil,
	)
	args := map[string]any{
		"kind": "buy", "brokerage_id": f.xp, "instrument": "KNRI11", "date": "2026-10-05",
		"quantity": "10", "unit_price": "100",
	}

	p := previewTool(t, f.h, "record_investment", args)
	if p.Target != "XP" || p.Changes[0].After.Text != "KNRI11" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	var accounts struct {
		Items []struct {
			ID       string `json:"id"`
			ParentID string `json:"parent_id"`
			Currency string `json:"currency"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)

	holding := ""

	for _, a := range accounts.Items {
		if a.ParentID == f.xp && a.Currency == "KNRI11" {
			holding = a.ID
		}
	}

	if got := amountsByAccount(
		f.h.Transaction(out.TransactionID),
	); holding == "" || got[holding] != 10 ||
		got[f.cash] != -100000 {
		t.Fatalf("holding %q, postings = %v", holding, got)
	}
}

func TestRecordInvestmentErrorNamesNextStep(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	empty := f.h.Account(
		"Empty broker",
		"asset",
		"brokerage",
		map[string]any{"institution_id": f.institution},
	)

	r := f.h.Tool("record_investment", map[string]any{
		"kind": "buy", "brokerage_id": empty, "instrument": "MXRF11", "date": "2026-10-05",
		"quantity": "10", "unit_price": "10",
	})
	f.h.ExpectToolError(r, "brokerage_cash_missing", "")

	if !strings.Contains(string(r.Content), "create a cash account named Cash") {
		t.Fatalf("error = %s", r.Content)
	}
}
