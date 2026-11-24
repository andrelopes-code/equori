package domain

import (
	"math"
	"slices"
	"testing"
	"time"
)

func TestStepDates(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		from, to time.Time
		step     string
		want     []time.Time
		wantLen  int
		wantOK   bool
	}{
		{
			"month",
			seriesDate(2025, 11, 1), seriesDate(2026, 1, 9), "month",
			[]time.Time{seriesDate(2025, 11, 30), seriesDate(2025, 12, 31), seriesDate(2026, 1, 9)},
			3, true,
		},
		{
			"month, to is a month end",
			seriesDate(2025, 11, 1), seriesDate(2025, 12, 31), "month",
			[]time.Time{seriesDate(2025, 11, 30), seriesDate(2025, 12, 31)},
			2, true,
		},
		{
			"week",
			seriesDate(2026, 10, 1), seriesDate(2026, 10, 31), "week",
			[]time.Time{
				seriesDate(2026, 10, 3), seriesDate(2026, 10, 10), seriesDate(2026, 10, 17),
				seriesDate(2026, 10, 24), seriesDate(2026, 10, 31),
			},
			5, true,
		},
		{
			"day",
			seriesDate(2026, 10, 25),
			seriesDate(2026, 10, 27),
			"day",
			[]time.Time{
				seriesDate(2026, 10, 25),
				seriesDate(2026, 10, 26),
				seriesDate(2026, 10, 27),
			},
			3,
			true,
		},
		{
			"one day",
			seriesDate(2026, 10, 25), seriesDate(2026, 10, 25), "month",
			[]time.Time{seriesDate(2026, 10, 25)},
			1, true,
		},
		{"reversed", seriesDate(2026, 10, 26), seriesDate(2026, 10, 25), "day", nil, 0, false},
		{"unknown step", seriesDate(2026, 10, 1), seriesDate(2026, 10, 25), "year", nil, 0, false},
		{"400 days", seriesDate(2025, 1, 1), seriesDate(2026, 2, 4), "day", nil, 400, true},
		{"401 days", seriesDate(2025, 1, 1), seriesDate(2026, 2, 5), "day", nil, 0, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, ok := StepDates(tc.from, tc.to, tc.step)
			if ok != tc.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tc.wantOK)
			}

			if len(got) != tc.wantLen {
				t.Fatalf("len = %d, want %d", len(got), tc.wantLen)
			}

			if tc.want != nil && !slices.EqualFunc(got, tc.want, time.Time.Equal) {
				t.Fatalf("dates = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestWholeMonthGrowth(t *testing.T) {
	t.Parallel()

	rates := map[time.Time]float64{
		seriesDate(2025, 11, 1): 0.0045,
		seriesDate(2025, 12, 1): 0.0045,
		seriesDate(2026, 1, 1):  0.0045,
	}
	gap := map[time.Time]float64{
		seriesDate(2025, 11, 1): 0.0045,
		seriesDate(2026, 1, 1):  0.0045,
	}

	tests := []struct {
		name     string
		from, to time.Time
		rates    map[time.Time]float64
		wantEnds []time.Time
		wantFact []float64
	}{
		{
			"two whole months",
			seriesDate(2025, 11, 1), seriesDate(2026, 1, 9), rates,
			[]time.Time{seriesDate(2025, 11, 30), seriesDate(2025, 12, 31)},
			[]float64{1.0045, 1.00902025},
		},
		{
			"starts mid month",
			seriesDate(2025, 11, 2), seriesDate(2026, 1, 31), rates,
			[]time.Time{seriesDate(2025, 12, 31), seriesDate(2026, 1, 31)},
			[]float64{1.0045, 1.00902025},
		},
		{
			"gap",
			seriesDate(2025, 11, 1), seriesDate(2026, 2, 28), gap,
			[]time.Time{seriesDate(2025, 11, 30)},
			[]float64{1.0045},
		},
		{"none", seriesDate(2025, 11, 1), seriesDate(2025, 11, 20), rates, nil, nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ends, factors := WholeMonthGrowth(tc.from, tc.to, tc.rates)
			if !slices.EqualFunc(ends, tc.wantEnds, time.Time.Equal) {
				t.Fatalf("ends = %v, want %v", ends, tc.wantEnds)
			}

			if len(factors) != len(tc.wantFact) {
				t.Fatalf("factors = %v, want %v", factors, tc.wantFact)
			}

			for i, want := range tc.wantFact {
				if math.Abs(factors[i]-want) > 1e-12 {
					t.Fatalf("factors[%d] = %v, want %v", i, factors[i], want)
				}
			}
		})
	}
}

func seriesDate(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}
