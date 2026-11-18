package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"
)

// S634 (coverage row U-01): the come-cotas of a fund is estimated on the gain of its units since
// the later of their average cost and the price of the previous come-cotas: 15% for a long-term
// fund, 20% for a short-term one (Lei 14.754/2023 art. 17).
func TestS634UnitTaxEstimate(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		subtype string
		want    []int64
	}{
		{"fixed_income_fund", []int64{7500, 4500}},
		{"short_term_fund", []int64{10000, 6000}},
	} {
		t.Run(tc.subtype, func(t *testing.T) {
			t.Parallel()
			f := newFundEventFixture(t, tc.subtype)

			for date, value := range map[string]string{"2026-05-29": "10.50", "2026-11-30": "10.80"} {
				f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
					"instrument": fundCode, "quote_instrument": "BRL", "date": date, "value": value,
				}, http.StatusCreated, nil)
			}

			f.h.Dispatch()

			var out struct {
				Items []struct {
					Date         string  `json:"date"`
					EstimatedTax *amount `json:"estimated_tax"`
				} `json:"items"`
			}
			f.h.MustDo(
				http.MethodGet,
				"/api/v1/fixed-income-events?from=2026-05-01&to=2026-12-31",
				nil,
				http.StatusOK,
				&out,
			)

			var got []int64
			for _, e := range out.Items {
				if e.EstimatedTax == nil {
					t.Fatalf("event %s: no estimated_tax", e.Date)
				}

				got = append(got, e.EstimatedTax.Amount)
			}

			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("estimated_tax = %v, want %v", got, tc.want)
			}
		})
	}
}
