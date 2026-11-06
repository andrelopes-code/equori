package domain

import (
	"math"
	"testing"
)

func TestPeriodFactor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		start  int64
		ends   []Subperiod
		want   float64
		wantOK bool
	}{
		{"no flow", 100000, []Subperiod{{Value: 105000}}, 1.05, true},
		// 10% before the deposit of 1,000.00 and 10% after it: 1.1 × 1.1.
		{"a deposit inside the period", 100000, []Subperiod{{Value: 210000, Flow: 100000}, {Value: 231000}}, 1.21, true},
		{"a withdrawal inside the period", 100000, []Subperiod{{Value: 60000, Flow: -50000}, {Value: 66000}}, 1.21, true},
		{"an empty start and a first deposit", 0, []Subperiod{{Value: 100000, Flow: 100000}, {Value: 110000}}, 1.1, true},
		{"a gain on an empty start", 0, []Subperiod{{Value: 100500, Flow: 100000}}, 0, false},
		{"total loss", 100000, []Subperiod{{Value: 0}}, 0, false},
		{"no subperiod", 100000, nil, 1, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := PeriodFactor(tt.start, tt.ends)
			if ok != tt.wantOK || (ok && math.Abs(got-tt.want) > 1e-12) {
				t.Fatalf("PeriodFactor = %v, %v; want %v, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}

func TestFactorBP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		factor float64
		want   int
	}{
		{1.0033, 33},
		{1, 0},
		{0.9, -1000},
	}
	for _, tt := range tests {
		if got := FactorBP(tt.factor); got != tt.want {
			t.Errorf("FactorBP(%v) = %d, want %d", tt.factor, got, tt.want)
		}
	}
}

func TestIndexFactor(t *testing.T) {
	t.Parallel()

	got := IndexFactor([]float64{0.01, 0.02})
	if math.Abs(got-1.0302) > 1e-12 {
		t.Fatalf("IndexFactor = %v, want 1.0302", got)
	}
}

func TestIndexPercentBP(t *testing.T) {
	t.Parallel()

	rates := []float64{0.00055131, 0.00055131, 0.00055131}
	at := func(p float64) float64 {
		f := 1.0
		for _, r := range rates {
			f *= 1 + p*r
		}

		return f
	}

	tests := []struct {
		name   string
		factor float64
		rates  []float64
		want   int
		wantOK bool
	}{
		{"one hundred per cent", at(1), rates, 10000, true},
		{"one hundred and ten per cent", at(1.1), rates, 11000, true},
		{"ninety and a half per cent", at(0.905), rates, 9050, true},
		{"no growth", 1, rates, 0, true},
		{"a loss", at(-0.5), rates, -5000, true},
		{"beyond the interval", at(20), rates, 0, false},
		{"a rate that is not positive", 1.001, []float64{0.001, 0}, 0, false},
		{"no rate", 1.001, nil, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := IndexPercentBP(tt.factor, tt.rates)
			if ok != tt.wantOK || (ok && got != tt.want) {
				t.Fatalf("IndexPercentBP = %d, %v; want %d, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}
