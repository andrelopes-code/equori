package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type gainTaxOut struct {
	GainTax []struct {
		Month string `json:"month"`
		Lines []struct {
			Pool     string     `json:"pool"`
			Exempt   tool.Money `json:"exempt"`
			Base     tool.Money `json:"base"`
			Tax      tool.Money `json:"tax"`
			Withheld tool.Money `json:"withheld"`
		} `json:"lines"`
		Darf tool.Money `json:"darf"`
	} `json:"gain_tax"`
}

// stockTrade records one trade of PETR4 at the cash account of the fixture; taxes is the tax
// withheld on a sale, in cents.
func (f fixture) stockTrade(
	t *testing.T,
	side, date string,
	quantity int64,
	price string,
	taxes int64,
) {
	t.Helper()

	body := map[string]any{
		"account_id": f.petr4, "cash_account_id": f.cash, "side": side, "date": date,
		"quantity": units(quantity, "PETR4"), "unit_price": price,
	}
	if taxes != 0 {
		body["taxes"] = apitest.BRL(taxes)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/trades", body, http.StatusCreated, nil)
}

// S628 (monthly gain tax design GT2 to GT5): a January sale of R$ 7,000.00 of stocks is exempt;
// a February sale of R$ 25,000.00 pays 15% of its gain less the tax withheld.
// S629 (GT1, GT5): a day trade of March owes R$ 7.60, carried to the DARF of April.
func TestS628S629GainTax(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-05-01"))
	f.stockTrade(t, "buy", "2026-01-05", 1000, "10.00", 0)
	f.stockTrade(t, "sell", "2026-01-20", 500, "14.00", 0)
	f.stockTrade(t, "sell", "2026-02-10", 500, "50.00", 125)
	f.stockTrade(t, "buy", "2026-03-10", 100, "10.00", 0)
	f.stockTrade(t, "sell", "2026-03-10", 100, "10.40", 40)
	f.stockTrade(t, "buy", "2026-04-14", 100, "10.00", 0)
	f.stockTrade(t, "sell", "2026-04-14", 100, "11.00", 100)
	f.h.Dispatch()

	var got gainTaxOut
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026, "view": "gain_tax"}, &got)

	want := []struct{ month, pool, exempt, base, tax, withheld, darf string }{
		{"2026-01", "ordinary", "2000.00", "0.00", "0.00", "0.00", "0.00"},
		{"2026-02", "ordinary", "0.00", "20000.00", "3000.00", "1.25", "2998.75"},
		{"2026-03", "day_trade", "0.00", "40.00", "8.00", "0.40", "0.00"},
		{"2026-04", "day_trade", "0.00", "100.00", "20.00", "1.00", "26.60"},
	}
	if len(got.GainTax) != len(want) {
		t.Fatalf("months = %+v", got.GainTax)
	}

	for i, w := range want {
		m := got.GainTax[i]
		if len(m.Lines) != 1 {
			t.Fatalf("%s lines = %+v", m.Month, m.Lines)
		}

		l := m.Lines[0]
		if m.Month != w.month || l.Pool != w.pool || l.Exempt.Amount != w.exempt ||
			l.Base.Amount != w.base || l.Tax.Amount != w.tax || l.Withheld.Amount != w.withheld ||
			m.Darf.Amount != w.darf {
			t.Errorf("month %d = %s %+v darf %s, want %+v", i, m.Month, l, m.Darf.Amount, w)
		}
	}
}

// GT7, X2: a book outside Brazil has no monthly tax on its sales.
func TestGainTaxOutsideBrazil(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-05-01"))
	f.moveToRegion(t, "DE")
	f.stockTrade(t, "buy", "2026-01-05", 1000, "10.00", 0)
	f.stockTrade(t, "sell", "2026-02-10", 500, "50.00", 0)
	f.h.Dispatch()

	var got gainTaxOut
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026, "view": "gain_tax"}, &got)

	if len(got.GainTax) != 0 {
		t.Errorf("months = %+v, want none", got.GainTax)
	}
}
