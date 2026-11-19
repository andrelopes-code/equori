package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S637 (coverage row U-08): an ETF quoted in dollars bought and sold in 2025 at a gain pays 15% of
// it in the annual return (Lei 14.754/2023 art. 2).
func TestS637AbroadTax(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.As(apitest.Brazil()))
	voo := security("VOO", "etf")
	voo["quote_currency"], voo["exchange"] = "USD", "ARCX"
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", voo, http.StatusCreated, nil)

	ibkr := f.h.Account("IBKR", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "currency": "USD",
	})
	child := func(name, currency string) string {
		return f.h.Account(name, "asset", "brokerage", map[string]any{
			"institution_id": f.institution, "parent_id": ibkr, "currency": currency,
		})
	}
	brl, account := f.cash, child("IBKR VOO", "VOO")

	f.h.Record("2025-03-01", apitest.Posting(brl, 1000000), apitest.Posting(f.dividends, -1000000))

	for _, tr := range []struct{ side, date, price string }{
		{"buy", "2025-03-03", "500.00"},
		{"sell", "2025-09-01", "600.00"},
	} {
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id": account, "cash_account_id": brl, "side": tr.side, "date": tr.date,
			"quantity": units(10, "VOO"), "unit_price": tr.price,
		}, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	type text struct {
		Amount string `json:"amount"`
	}

	var out struct {
		AbroadTax struct {
			Base, Tax, Due text
		} `json:"abroad_tax"`
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2025, "view": "abroad_tax"}, &out)

	// The trades are paid in reais: 10 × (600.00 − 500.00), 1,000.00 of gain, 150.00 of tax.
	got := out.AbroadTax
	if got.Base.Amount != "1000.00" || got.Tax.Amount != "150.00" || got.Due.Amount != "150.00" {
		t.Errorf("abroad_tax = %+v, want base 1000.00, tax 150.00, due 150.00", got)
	}
}
