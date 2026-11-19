package domain

import (
	"testing"
	"time"
)

func TestCustodyFee(t *testing.T) {
	t.Parallel()

	day := func(s string) time.Time {
		d, _ := time.Parse(time.DateOnly, s)
		return d
	}
	lots := []Lot{{AcquiredOn: day("2026-01-05"), Quantity: 100, Cost: 100000}}
	sale := day("2026-07-04")

	for _, tc := range []struct {
		name string
		rule CustodyRule
		want int64
	}{
		{"180 days at 0.20%", CustodyRule{RateBP: 20}, 108},
		{"only above the exemption", CustodyRule{RateBP: 20, ExemptMinor: 100000}, 10},
		{"below the exemption", CustodyRule{RateBP: 20, ExemptMinor: 200000}, 0},
		{
			"paid to a coupon",
			CustodyRule{RateBP: 20, PaidTo: func(time.Time) time.Time { return day("2026-07-01") }},
			2,
		},
	} {
		if got := CustodyFee(tc.rule, lots, 110000, sale); got != tc.want {
			t.Errorf("%s: CustodyFee = %d, want %d", tc.name, got, tc.want)
		}
	}
}
