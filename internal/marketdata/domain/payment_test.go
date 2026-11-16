package domain

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestSchedule(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		first     string
		matures   string
		every     int
		want      []string
		wantField string
	}{
		{
			name: "semiannual", first: "2026-07-06", matures: "2027-01-05", every: 6,
			want: []string{"2026-07-06", "2027-01-05"},
		},
		{
			name: "month end", first: "2026-01-31", matures: "2026-05-15", every: 1,
			want: []string{
				"2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-15",
			},
		},
		{
			name: "interval outside the set", first: "2026-01-31", matures: "2026-05-15",
			every: 2, wantField: "interest_every_months",
		},
		{
			name: "first after maturity", first: "2027-02-01", matures: "2027-01-05",
			every: 6, wantField: "first_payment_on",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := Schedule(date(tc.first), date(tc.matures), tc.every)
			if tc.wantField != "" {
				assertField(t, err, tc.wantField)

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			var days []string
			for _, p := range got {
				if !p.PaysInterest || p.AmortizationBP != 0 {
					t.Errorf("payment %+v, want interest only", p)
				}

				days = append(days, p.PaysOn.Format(time.DateOnly))
			}

			if fmt.Sprint(days) != fmt.Sprint(tc.want) {
				t.Fatalf("dates = %v, want %v", days, tc.want)
			}
		})
	}
}

func TestValidatePayments(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		payments  []Payment
		wantField string
	}{
		{
			name:      "on the issue date",
			payments:  []Payment{{PaysOn: date("2026-01-05"), PaysInterest: true}},
			wantField: "payments[0]",
		},
		{
			name: "repeated date",
			payments: []Payment{
				{PaysOn: date("2026-07-06"), PaysInterest: true},
				{PaysOn: date("2026-07-06"), PaysInterest: true},
			},
			wantField: "payments[1]",
		},
		{
			name: "amortizations above the principal",
			payments: []Payment{
				{PaysOn: date("2026-07-06"), AmortizationBP: 6000},
				{PaysOn: date("2027-01-05"), AmortizationBP: 5000},
			},
			wantField: "payments",
		},
		{
			name:      "pays nothing",
			payments:  []Payment{{PaysOn: date("2026-07-06")}},
			wantField: "payments[0]",
		},
		{
			name: "amortizations of the whole principal",
			payments: []Payment{
				{PaysOn: date("2026-07-06"), AmortizationBP: 5000},
				{PaysOn: date("2027-01-05"), AmortizationBP: 5000},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := couponTerms(tc.payments).Validate(BusinessDayIndexes{"cdi"})
			if tc.wantField == "" {
				if err != nil {
					t.Fatalf("Validate = %v, want nil", err)
				}

				return
			}

			assertField(t, err, tc.wantField)
		})
	}
}

func assertField(t *testing.T, err error, field string) {
	t.Helper()

	var fe *FieldError
	if !errors.As(err, &fe) {
		t.Fatalf("error = %v, want *FieldError", err)
	}

	if fe.Field != field {
		t.Fatalf("field = %q, want %q", fe.Field, field)
	}
}
