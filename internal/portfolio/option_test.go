package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// S623 (listed options design W3, O6): an option that expires is a realized result with proceeds
// zero and its premium lost, in the tax class option.
func TestOptionWriteOffInTaxYear(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETRK300", "option"),
		http.StatusCreated,
		nil,
	)
	option := f.h.Account("XP PETRK300", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": "PETRK300",
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": option, "cash_account_id": f.cash, "side": "buy", "date": "2026-10-05",
		"quantity": units(100, "PETRK300"), "unit_price": "0.50",
	}, http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": option, "side": "write_off", "date": "2026-10-20",
		"quantity": units(100, "PETRK300"),
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	var got struct {
		Sales []struct {
			Instrument string     `json:"instrument"`
			Proceeds   tool.Money `json:"proceeds"`
			Result     tool.Money `json:"result"`
			TaxClass   string     `json:"tax_class"`
		} `json:"sales"`
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026, "view": "sales"}, &got)

	if len(got.Sales) != 1 || got.Sales[0].Proceeds.Amount != "0.00" ||
		got.Sales[0].Result.Amount != "-50.00" || got.Sales[0].TaxClass != "option" {
		t.Errorf("sales = %+v, want the premium of 50.00 lost, class option", got.Sales)
	}
}
