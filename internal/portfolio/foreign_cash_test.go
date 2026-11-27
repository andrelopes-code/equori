package portfolio_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type abroadGains struct {
	AbroadTax *struct {
		Gains struct {
			Amount string `json:"amount"`
		} `json:"gains"`
	} `json:"abroad_tax"`
}

// S775 (foreign cash FC14, FC15): 1,000.00 USD bought for 5,000.00 BRL and spent at 5.50 realize
// 500.00 of exchange result when the balance earns a yield, and nothing when it does not.
func TestS775ExchangeResultOfRemuneratedBalance(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct{ yieldMode, want string }{
		{"auto", "500.00"},
		{"none", ""},
	} {
		t.Run(tc.yieldMode, func(t *testing.T) {
			t.Parallel()

			h := apitest.New(t, apitest.As(apitest.Brazil()), apitest.Today("2026-11-01"))
			cash := fundForeignCash(t, h, "BRL", 500000, 100000, tc.yieldMode, "2026-01-10")
			buyVOO(t, h, cash, "2026-04-10", "5.50")
			h.Dispatch()

			var out abroadGains
			toolOutput(
				t,
				h,
				"get_tax_year",
				map[string]any{"year": 2026, "view": "abroad_tax"},
				&out,
			)

			got := ""
			if out.AbroadTax != nil {
				got = out.AbroadTax.Gains.Amount
			}

			if got != tc.want {
				t.Errorf("abroad_tax gains = %q, want %q", got, tc.want)
			}
		})
	}
}

// S777 (R2): a region without a jurisdiction records the trade paid in dollars at its base cost
// and computes no tax abroad.
func TestS777ForeignCashNeutral(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.As(apitest.Neutral()), apitest.Today("2026-11-01"))
	cash := fundForeignCash(t, h, "NZD", 170000, 100000, "auto", "2026-01-10")
	buyVOO(t, h, cash, "2026-04-10", "1.70")
	h.Dispatch()

	got := h.Rows(`SELECT p.weight FROM ledger_posting p
		JOIN ledger_account a ON a.id = p.account_id WHERE a.instrument = 'VOO'`)
	if want := []string{"170000"}; !slices.Equal(got, want) {
		t.Fatalf("holding cost = %q, want %q", got, want)
	}

	var out abroadGains
	toolOutput(t, h, "get_tax_year", map[string]any{"year": 2026, "view": "abroad_tax"}, &out)

	if out.AbroadTax != nil {
		t.Errorf("abroad_tax = %+v, want none", out.AbroadTax)
	}
}

// fundForeignCash opens a USD brokerage with a Cash USD account of the given yield_mode, funded
// by an exchange of base minor units for USD minor units, and returns the cash account.
func fundForeignCash(
	t *testing.T,
	h *apitest.Harness,
	base string,
	baseAmount, usdAmount int64,
	yieldMode, date string,
) string {
	t.Helper()

	voo := security("VOO", "etf")
	voo["quote_currency"], voo["exchange"] = "USD", "ARCX"
	h.MustDo(http.MethodPost, "/api/v1/instruments", voo, http.StatusCreated, nil)

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "IBKR"}, http.StatusCreated, &inst)

	brokerage := h.Account("IBKR", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "currency": "USD",
	})
	cash := h.Account("IBKR cash USD", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "parent_id": brokerage, "currency": "USD",
	})
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cash,
		map[string]any{"yield_mode": yieldMode}, http.StatusOK, nil)

	checking := h.Account("Checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	h.Record("2026-01-01", h.Posting(checking, 10000000), h.Posting(salary, -10000000))
	h.MustDo(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": checking, "to_account_id": cash, "date": date,
		"from_amount": map[string]any{"amount": baseAmount, "currency": base},
		"to_amount":   units(usdAmount, "USD"),
	}, http.StatusCreated, nil)

	return cash
}

// buyVOO buys 2 VOO at 500.00 USD, which is the whole 1,000.00 USD of the cash account.
func buyVOO(t *testing.T, h *apitest.Harness, cash, date, rate string) {
	t.Helper()

	var brokerage struct {
		ParentID string `json:"parent_id"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+cash, nil, http.StatusOK, &brokerage)
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"brokerage_id": brokerage.ParentID, "instrument": "VOO", "cash_account_id": cash,
		"side": "buy", "date": date, "unit_price": "500.00", "exchange_rate": rate,
		"quantity": units(2, "VOO"),
	}, http.StatusCreated, nil)
}
