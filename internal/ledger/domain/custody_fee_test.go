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

// Coverage row T-09: a fee by receipt takes its rate of the amount above the exemption of its
// date, nothing on its maturity, and no estimate for a date whose exemption is unknown.
func TestReceiptFee(t *testing.T) {
	t.Parallel()

	maturity := time.Date(2049, time.December, 15, 0, 0, 0, 0, time.UTC)
	rule := CustodyRule{
		ReceiptBP: 10,
		HeldTo:    maturity,
		ReceiptExempt: func(d time.Time) (int64, bool) {
			return 972600, d.Year() == 2026
		},
	}
	sale := time.Date(2026, time.July, 4, 0, 0, 0, 0, time.UTC)

	for _, tc := range []struct {
		name   string
		amount int64
		date   time.Time
		want   int64
		ok     bool
	}{
		{"above", 2000000, sale, 1027, true},
		{"below", 900000, sale, 0, true},
		{"at maturity", 2000000, maturity, 0, true},
		{"unknown year", 2000000, time.Date(2027, time.July, 4, 0, 0, 0, 0, time.UTC), 0, false},
	} {
		if got, ok := ReceiptFee(rule, tc.amount, tc.date); got != tc.want || ok != tc.ok {
			t.Errorf("%s: ReceiptFee = %d, %v; want %d, %v", tc.name, got, ok, tc.want, tc.ok)
		}
	}
}
