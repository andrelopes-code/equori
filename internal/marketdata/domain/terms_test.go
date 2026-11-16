package domain

import (
	"errors"
	"testing"
)

func TestValidateWithoutBusinessDayIndex(t *testing.T) {
	cases := []struct {
		name     string
		indexID  string
		dayCount string
		daily    BusinessDayIndexes
		wantErr  bool
		wantText string
	}{
		{
			"bus252 on an index of the set",
			"cdi",
			DayCountBus252,
			BusinessDayIndexes{"cdi"},
			false,
			"",
		},
		{
			"bus252 on another index", "ipca", DayCountBus252, BusinessDayIndexes{"cdi"}, true,
			"bus252 counts the business days of the cdi index or of calendar_id; " +
				"use act365 or set calendar_id",
		},
		{"bus252 in a region without business-day indexes", "cdi", DayCountBus252, nil, true, ""},
		{"act365 without a set", "ipca", DayCountAct365, nil, false, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			terms := Terms{
				IssuedOn: date("2026-01-02"), MaturesOn: date("2027-01-02"), IndexID: tc.indexID,
				PercentOfIndexBP: 10000, DayCount: tc.dayCount, FaceValue: 100000,
			}

			err := terms.Validate(tc.daily)

			if !tc.wantErr {
				if err != nil {
					t.Fatalf("Validate = %v, want nil", err)
				}

				return
			}

			var fe *FieldError
			if !errors.As(err, &fe) {
				t.Fatalf("Validate = %v, want *FieldError", err)
			}

			if fe.Field != "day_count" {
				t.Fatalf("field = %q, want day_count", fe.Field)
			}

			if tc.wantText != "" && fe.Message != tc.wantText {
				t.Fatalf("message = %q, want %q", fe.Message, tc.wantText)
			}
		})
	}
}

func TestValidateTerms(t *testing.T) {
	cases := []struct {
		name      string
		terms     Terms
		daily     BusinessDayIndexes
		wantField string
	}{
		{
			name:  "pre-fixed bus252 with a calendar",
			terms: preFixedTerms(func(t *Terms) { t.CalendarID = "br_banking" }),
			daily: BusinessDayIndexes{"cdi"},
		},
		{
			name:      "pre-fixed bus252 without a calendar",
			terms:     preFixedTerms(func(t *Terms) {}),
			daily:     BusinessDayIndexes{"cdi"},
			wantField: "day_count",
		},
		{
			name:      "calendar outside the pattern",
			terms:     preFixedTerms(func(t *Terms) { t.CalendarID = "BR" }),
			daily:     BusinessDayIndexes{"cdi"},
			wantField: "calendar_id",
		},
		{
			name: "redeemable before the issue",
			terms: preFixedTerms(func(t *Terms) {
				t.CalendarID = "br_banking"
				t.RedeemableFrom = date("2026-01-01")
			}),
			daily:     BusinessDayIndexes{"cdi"},
			wantField: "redeemable_from",
		},
		{
			name: "redeemable on the maturity",
			terms: preFixedTerms(func(t *Terms) {
				t.CalendarID = "br_banking"
				t.RedeemableFrom = date("2030-01-02")
			}),
			daily: BusinessDayIndexes{"cdi"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.terms.Validate(tc.daily)

			if tc.wantField == "" {
				if err != nil {
					t.Fatalf("Validate = %v, want nil", err)
				}

				return
			}

			var fe *FieldError
			if !errors.As(err, &fe) {
				t.Fatalf("Validate = %v, want *FieldError", err)
			}

			if fe.Field != tc.wantField {
				t.Fatalf("field = %q, want %q", fe.Field, tc.wantField)
			}
		})
	}
}

func preFixedTerms(mutate func(*Terms)) Terms {
	terms := Terms{
		IssuedOn: date("2026-01-02"), MaturesOn: date("2030-01-02"), SpreadBP: 1200,
		DayCount: DayCountBus252, FaceValue: 100000,
	}
	mutate(&terms)

	return terms
}
