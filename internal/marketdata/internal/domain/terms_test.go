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
		{"bus252 on an index of the set", "cdi", DayCountBus252, BusinessDayIndexes{"cdi"}, false, ""},
		{
			"bus252 on another index", "ipca", DayCountBus252, BusinessDayIndexes{"cdi"}, true,
			"bus252 counts the business days of the cdi index; use act365",
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
