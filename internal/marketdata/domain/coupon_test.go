package domain

import (
	"testing"
)

func TestCouponsPreFixed(t *testing.T) {
	t.Parallel()

	payments, err := Schedule(date("2026-07-06"), date("2027-01-05"), 6)
	if err != nil {
		t.Fatal(err)
	}

	got, err := Coupons(
		couponTerms(payments), BusinessDayIndexes{"cdi"}, 2, nil, weekday,
	)
	if err != nil {
		t.Fatal(err)
	}

	want := []struct{ date, interest, principal string }{
		{"2026-07-06", "60.205980713929", "1000.000000000000"},
		{"2027-01-05", "60.682880599413", "1000.000000000000"},
	}

	if len(got) != len(want) {
		t.Fatalf("Coupons = %+v, want %d coupons", got, len(want))
	}

	for i, w := range want {
		c := got[i]
		if c.Date != date(w.date) || c.Interest != w.interest || c.Principal != w.principal ||
			c.RateMissing || !c.PaysInterest {
			t.Errorf("coupon %d = %+v, want %+v", i, c, w)
		}
	}
}

func TestCouponsCDI(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		paysOn      string
		interest    string
		principal   string
		rateMissing bool
	}{
		{"published", "2026-01-07", "1.654841995715", "1000.000000000000", false},
		{"after the last rate", "2026-01-12", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			terms := cdb(10000, 0)
			terms.Payments = []Payment{{PaysOn: date(tt.paysOn), PaysInterest: true}}

			got, err := Coupons(terms, BusinessDayIndexes{"cdi"}, 2, cdiWeek(), nil)
			if err != nil {
				t.Fatal(err)
			}

			if len(got) != 1 {
				t.Fatalf("Coupons = %+v, want 1 coupon", got)
			}

			c := got[0]
			if c.Interest != tt.interest || c.Principal != tt.principal ||
				c.RateMissing != tt.rateMissing {
				t.Errorf("coupon = %+v", c)
			}
		})
	}
}

func TestCouponsAmortization(t *testing.T) {
	t.Parallel()

	payments, err := Schedule(date("2026-07-06"), date("2027-01-05"), 6)
	if err != nil {
		t.Fatal(err)
	}

	payments[0].AmortizationBP = 5000

	got, err := Coupons(
		couponTerms(payments), BusinessDayIndexes{"cdi"}, 2, nil, weekday,
	)
	if err != nil {
		t.Fatal(err)
	}

	if got[0].AmortizationBP != 5000 || got[0].Interest != "60.205980713929" {
		t.Errorf("coupon = %+v, want 5000 bp and the interest of the full unit", got[0])
	}
}
