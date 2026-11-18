package portfolio_test

import (
	"maps"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Coverage row U-05: a PGBL is a fund of subtype pgbl; the tax year lists the contributions it
// received as the base of the deduction, a VGBL adds nothing to it, and a PGBL redemption carries
// the class pension_pgbl.
func TestPensionContributions(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	plan := func(code, subtype string) string {
		body := security(code, "fund")
		maps.Copy(body, map[string]any{"subtype": subtype})
		delete(body, "exchange")
		f.h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)

		return f.h.Account(
			"Previdência "+code,
			"asset",
			"brokerage",
			map[string]any{"institution_id": f.institution, "parent_id": f.xp, "currency": code},
		)
	}
	pgbl, vgbl := plan("PREVP", "pgbl"), plan("PREVV", "vgbl")

	trade := func(account, code, side, date string, quantity int64, price string) {
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      account,
			"cash_account_id": f.cash,
			"side":            side,
			"date":            date,
			"quantity":        units(quantity, code),
			"unit_price":      price,
		}, http.StatusCreated, nil)
	}
	trade(pgbl, "PREVP", "buy", "2025-12-10", 100, "1.00")
	trade(pgbl, "PREVP", "buy", "2026-03-10", 1000, "1.00")
	trade(pgbl, "PREVP", "buy", "2026-06-10", 500, "1.10")
	trade(pgbl, "PREVP", "sell", "2026-09-10", 200, "1.20")
	trade(vgbl, "PREVV", "buy", "2026-04-10", 300, "1.00")
	f.h.Dispatch()

	var got struct {
		Sales []struct {
			Instrument string `json:"instrument"`
			TaxClass   string `json:"tax_class"`
		} `json:"sales"`
		DeductibleContributions *tool.Money `json:"deductible_contributions"`
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026}, &got)

	if got.DeductibleContributions == nil || got.DeductibleContributions.Amount != "1550.00" ||
		got.DeductibleContributions.Currency != "BRL" {
		t.Errorf("deductible_contributions = %+v, want 1550.00 BRL", got.DeductibleContributions)
	}

	if len(got.Sales) != 1 || got.Sales[0].TaxClass != "pension_pgbl" {
		t.Errorf("sales = %+v, want one pension_pgbl redemption", got.Sales)
	}

	// The year before holds the first contribution only.
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2025}, &got)

	if got.DeductibleContributions == nil || got.DeductibleContributions.Amount != "100.00" {
		t.Errorf("2025 deductible_contributions = %+v, want 100.00", got.DeductibleContributions)
	}
}
