package ledger_test

import (
	"net/http"
	"testing"
)

// S638 (coverage row T-09): a sale of a Tesouro bond deducts the custody fee of B3, 0.20% a year
// of its value pro rata since the purchase or the last coupon; a Tesouro Selic sale up to
// R$ 10,000.00 pays none (B3, tariffs of Tesouro Direto).
func TestCustodyFeeOfATesouroSale(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, code, sale string
		fee, net         int64
	}{
		// 1,100.00 × 0.20% × 180 / 365 = 1.08; income tax 22.5% of 100.00.
		{"LTN after 180 days", "LTN.20300101", "2026-07-04", 108, 110000 - 2250 - 108},
		// The coupon of 2026-07-01 paid the fee to that day: 33 days left.
		{"NTNF after its coupon", "NTNF.20310101", "2026-08-03", 20, 110000 - 2000 - 20},
		{"LFT below the exemption", "LFT.20300301", "2026-07-04", 0, 110000 - 2250},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newLotFixtureOf(t, tc.code, "fixed_income", "tesouro")
			f.trade(t, "buy", "2026-01-05", 100, "10.00")

			var out struct {
				CustodyFee map[string]any `json:"custody_fee"`
				Net        map[string]any `json:"net"`
			}
			f.h.MustDo(
				http.MethodGet,
				f.withholdingPath(tc.sale, 100, 110000),
				nil,
				http.StatusOK,
				&out,
			)

			if out.CustodyFee == nil || out.CustodyFee["amount"] != float64(tc.fee) ||
				out.Net["amount"] != float64(tc.net) {
				t.Errorf(
					"custody_fee = %v, net = %v; want %d, %d",
					out.CustodyFee,
					out.Net,
					tc.fee,
					tc.net,
				)
			}
		})
	}
}
