package domain

import "testing"

// Progressive rate design PR1 to PR4 (S626, S627): 6% a year, 12% after 31 days held. The expected
// prices were computed independently with 60-digit decimals and rounded half to even to 12
// decimals; the stepped price chains the rounded prices of each step.
func TestAccrueSteps(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn:  date("2026-01-01"),
		MaturesOn: date("2030-01-01"),
		SpreadBP:  600,
		DayCount:  DayCountAct365,
		FaceValue: 100000,
	}
	steps := []RateStep{{AfterDays: 31, SpreadBP: 1200}}

	for _, tc := range []struct {
		apply string
		want  map[string]string
	}{
		{StepsRetroactive, map[string]string{
			"2026-01-30": "1004.640317564163",
			"2026-02-02": "1009.985188163684",
			"2026-02-03": "1010.298826697262",
		}},
		{StepsStepped, map[string]string{
			"2026-01-30": "1004.640317564163",
			"2026-02-02": "1005.121577683287",
			"2026-02-03": "1005.433705882182",
		}},
	} {
		t.Run(tc.apply, func(t *testing.T) {
			t.Parallel()

			prices, err := AccrueSteps(
				terms,
				steps,
				tc.apply,
				BusinessDayIndexes{"cdi"},
				2,
				nil,
				date("2026-01-30"),
				date("2026-02-03"),
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			got := values(prices)
			for day, want := range tc.want {
				if got[day] != want {
					t.Errorf("%s = %q, want %q", day, got[day], want)
				}
			}

			if _, ok := got["2026-01-29"]; ok {
				t.Error("a day before from has a price")
			}
		})
	}
}

// PR1: steps take days held above zero, increasing, and a known rule.
func TestCheckRateSteps(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		steps []RateStep
		apply string
		ok    bool
	}{
		{[]RateStep{{AfterDays: 180, PercentOfIndexBP: 10500}}, StepsRetroactive, true},
		{[]RateStep{{AfterDays: 0}}, StepsStepped, false},
		{[]RateStep{{AfterDays: 180}, {AfterDays: 180}}, StepsStepped, false},
		{[]RateStep{{AfterDays: 180}}, "later", false},
		{nil, "", true},
		{nil, StepsStepped, false},
	} {
		if err := CheckRateSteps(tc.steps, tc.apply); (err == nil) != tc.ok {
			t.Errorf("CheckRateSteps(%v, %q) = %v, want ok %v", tc.steps, tc.apply, err, tc.ok)
		}
	}
}
