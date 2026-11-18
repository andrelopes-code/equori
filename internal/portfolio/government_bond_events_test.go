package portfolio_test

import (
	"cmp"
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S632 (coverage rows T-03, T-05): a Tesouro bond with half-yearly interest pays a coupon every 6
// months back from its maturity, on the next business day. An NTN-F pays 1,000.00 × (1.10^½ − 1)
// a unit; an NTN-B pays 6% a year of a nominal value the source does not publish, so its amount
// is missing. A bond without coupons matures on its date.
func TestS632GovernmentBondEvents(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.Today("2026-06-15"))
	accounts := map[string]string{}

	for _, code := range []string{"NTNF.20290101", "NTNB.20350515", "LTN.20270101"} {
		f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
			"code": code, "type": "fixed_income", "scale": 2, "name": code, "quote_currency": "BRL",
		}, http.StatusCreated, nil)

		accounts[code] = f.h.Account(code, "asset", "brokerage", map[string]any{
			"institution_id": f.institution, "parent_id": f.xp, "currency": code,
		})
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      accounts[code],
			"cash_account_id": f.cash,
			"side":            "buy",
			"date":            "2026-01-12",
			"quantity":        units(200, code),
			"unit_price":      "900.00",
		}, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-06-01&to=2027-01-31",
		nil,
		http.StatusOK,
		&out,
	)

	type row struct {
		Instrument, Date, Kind string
		Gross                  int64
		Missing                bool
	}

	got := make([]row, len(out.Items))
	for i, e := range out.Items {
		got[i] = row{Instrument: e.Instrument, Date: e.Date, Kind: e.Kind, Missing: e.RateMissing}
		if e.Gross != nil {
			got[i].Gross = e.Gross.Amount
		}
	}

	slices.SortFunc(got, func(a, b row) int {
		return cmp.Or(cmp.Compare(a.Date, b.Date), cmp.Compare(a.Instrument, b.Instrument))
	})

	want := []row{
		{"NTNF.20290101", "2026-07-01", "interest", 9762, false},
		{"NTNB.20350515", "2026-11-16", "interest", 0, true},
		{"LTN.20270101", "2027-01-04", "maturity", 200000, false},
		{"NTNF.20290101", "2027-01-04", "interest", 9762, false},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}
