package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// S639 (coverage row E-12): a day trade of a future, bought and sold on one day at its value in
// reais per contract, is a day-trade result of the class future: 20% of the gain, less the 1%
// withheld at source (Lei 11.033/2004 art. 2; IN RFB 1.585/2015 art. 54 and 65).
func TestFutureDayTradeTax(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.As(apitest.Brazil()))
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("WINZ26", "future"),
		http.StatusCreated,
		nil,
	)
	future := f.h.Account("XP WINZ26", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": "WINZ26",
	})
	f.h.Record(
		"2026-10-01",
		apitest.Posting(f.cash, 3000000),
		apitest.Posting(f.dividends, -3000000),
	)

	for _, tr := range []map[string]any{
		{"side": "buy", "unit_price": "26000.00"},
		{"side": "sell", "unit_price": "26100.00", "taxes": apitest.BRL(100)},
	} {
		tr["account_id"], tr["cash_account_id"], tr["date"] = future, f.cash, "2026-10-05"
		tr["quantity"] = units(1, "WINZ26")
		f.h.MustDo(http.MethodPost, "/api/v1/trades", tr, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	var got struct {
		GainTax []struct {
			Month string `json:"month"`
			Lines []struct {
				Pool string     `json:"pool"`
				Tax  tool.Money `json:"tax"`
			} `json:"lines"`
			Darf tool.Money `json:"darf"`
		} `json:"gain_tax"`
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026, "view": "gain_tax"}, &got)

	if len(got.GainTax) != 1 || len(got.GainTax[0].Lines) != 1 ||
		got.GainTax[0].Lines[0].Pool != "day_trade" || got.GainTax[0].Lines[0].Tax.Amount != "20.00" ||
		got.GainTax[0].Darf.Amount != "19.00" {
		t.Errorf("gain_tax = %+v, want day_trade 20.00 and a DARF of 19.00", got.GainTax)
	}
}
