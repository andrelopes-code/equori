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

	paidTo := func(time.Time) time.Time { return day("2026-07-01") }

	for _, tc := range []struct {
		name       string
		rule       CustodyRule
		pool, want int64
	}{
		{name: "180 days at 0.20%", rule: CustodyRule{RateBP: 20}, want: 108},
		{name: "above the exemption", rule: CustodyRule{RateBP: 20, ExemptMinor: 100000}, want: 10},
		{name: "below the exemption", rule: CustodyRule{RateBP: 20, ExemptMinor: 200000}},
		{name: "paid to a coupon", rule: CustodyRule{RateBP: 20, PaidTo: paidTo}, want: 2},
		// 600.00 of 10,600.00 above the exemption: 62.26 of the 1,100.00 charged over 180 days.
		{
			name: "pooled", rule: CustodyRule{RateBP: 20, ExemptMinor: 1000000},
			pool: 1060000, want: 6,
		},
	} {
		if got := CustodyFee(tc.rule, lots, 110000, tc.pool, sale); got != tc.want {
			t.Errorf("%s: CustodyFee = %d, want %d", tc.name, got, tc.want)
		}
	}
}
