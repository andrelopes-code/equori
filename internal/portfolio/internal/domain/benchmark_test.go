package domain

import (
	"math"
	"testing"
	"time"
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

func TestAnnualBP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		factor float64
		days   int
		basis  int
		want   int
		wantOK bool
	}{
		{"six cdi days at 0.055131%", math.Pow(1.00055131, 6), 6, 252, 1490, true},
		{"a whole year", 1.1, 252, 252, 1000, true},
		{"a loss", 0.99, 126, 252, -199, true},
		{"no day", 1.01, 0, 252, 0, false},
		{"no basis", 1.01, 6, 0, 0, false},
		{"total loss", 0, 6, 252, 0, false},
		{"overflow to infinity", 1.5, 1, 1_000_000, 0, false},
		{"above 10^7 bp", 1.1, 1, 252, 0, false},
		{"at the 10^7 bp limit", 1001, 252, 252, 10_000_000, true},
		{"inside the limit", 1.01, 1, 252, 112_740, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := AnnualBP(tt.factor, tt.days, tt.basis)
			if ok != tt.wantOK || (ok && got != tt.want) {
				t.Fatalf("AnnualBP = %d, %v; want %d, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}

func TestRealBP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		ret, inflation float64
		want           int
		wantOK         bool
	}{
		{"a return above inflation", 1.10, 1.05, 476, true},
		{"no return under inflation", 1, 1.00902, -89, true},
		{"no inflation", 1.10, 1, 1000, true},
		{"deflation", 1, 0.99, 101, true},
		{"total loss", 0, 1.05, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := RealBP(tt.ret, tt.inflation)
			if ok != tt.wantOK || (ok && got != tt.want) {
				t.Fatalf("RealBP = %d, %v; want %d, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}

func TestWholeMonths(t *testing.T) {
	t.Parallel()

	day := func(s string) time.Time {
		d, _ := time.Parse(time.DateOnly, s)
		return d
	}
	rates := map[time.Time]float64{day("2025-11-01"): 0.005, day("2025-12-01"): 0.004, day("2026-02-01"): 0.003}

	tests := []struct {
		name         string
		from, to     string
		first, until string
		months       int
		wantOK       bool
	}{
		{"two whole months", "2025-11-01", "2026-01-09", "2025-11-01", "2025-12-31", 2, true},
		{"a start inside a month skips it", "2025-11-02", "2025-12-31", "2025-12-01", "2025-12-31", 1, true},
		{"the first month without a rate ends the run", "2025-11-01", "2026-02-28", "2025-11-01", "2025-12-31", 2, true},
		{"no whole month", "2026-01-02", "2026-01-09", "", "", 0, false},
		{"a first month without a rate", "2026-01-01", "2026-02-28", "", "", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			first, until, monthly, ok := WholeMonths(day(tt.from), day(tt.to), rates)
			if ok != tt.wantOK || len(monthly) != tt.months {
				t.Fatalf("WholeMonths = %v, %v, %v, %v", first, until, monthly, ok)
			}

			if ok && (!first.Equal(day(tt.first)) || !until.Equal(day(tt.until))) {
				t.Fatalf("WholeMonths = %v to %v; want %s to %s", first, until, tt.first, tt.until)
			}
		})
	}
}

func TestRecordedPeriodFactor(t *testing.T) {
	t.Parallel()

	// A piece that starts at 0 and gains 200 holds no money: factor 1, not undefined.
	if f, ok := RecordedPeriodFactor(0, []Subperiod{{Value: 1_000_200, Flow: 1_000_000}, {Value: 1_000_350}}); !ok || f != 1+150.0/1_000_200 {
		t.Fatalf("factor = %v, %v", f, ok)
	}

	if _, ok := PeriodFactor(0, []Subperiod{{Value: 1_000_200, Flow: 1_000_000}}); ok {
		t.Fatal("PeriodFactor defined for a gain with no base")
	}

	if _, ok := RecordedPeriodFactor(-1, []Subperiod{{Value: 5, Flow: 0}}); ok {
		t.Fatal("negative base defined")
	}
}

func TestComparisonStart(t *testing.T) {
	t.Parallel()

	day := func(s string) time.Time { d, _ := time.Parse(time.DateOnly, s); return d }
	days := func(ss ...string) []time.Time {
		out := make([]time.Time, len(ss))
		for i, s := range ss {
			out[i] = day(s)
		}

		return out
	}

	tests := []struct {
		name      string
		credits   []time.Time
		flows     []time.Time
		want      time.Time
		restarted bool
	}{
		{"no flow", days("2026-01-02", "2026-02-02"), nil, day("2026-01-02"), false},
		{"flow in a 7 day gap", days("2026-01-02", "2026-01-09"), days("2026-01-05"), day("2026-01-02"), false},
		{"flow in an 8 day gap", days("2026-01-02", "2026-01-10"), days("2026-01-05"), day("2026-01-10"), true},
		{"flow on a credit day", days("2026-01-02", "2026-02-02"), days("2026-01-02", "2026-02-02"), day("2026-01-02"), false},
		{"last restart wins", days("2026-01-02", "2026-02-02", "2026-03-02"), days("2026-01-15", "2026-02-15"), day("2026-03-02"), true},
	}

	for _, tt := range tests {
		got, restarted := ComparisonStart(tt.credits, tt.flows)
		if !got.Equal(tt.want) || restarted != tt.restarted {
			t.Errorf("%s: got %s, %v", tt.name, got.Format(time.DateOnly), restarted)
		}
	}
}

func TestPercentErrorBP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		credits int
		yield   int64
		want    int
		ok      bool
	}{{4, 2204, 10, true}, {4, 88, 228, true}, {4, 24, 834, true}, {4, 0, 0, false}, {1, 1, 5000, true}}

	for _, tt := range tests {
		if got, ok := PercentErrorBP(tt.credits, tt.yield); got != tt.want || ok != tt.ok {
			t.Errorf("PercentErrorBP(%d, %d) = %d, %v", tt.credits, tt.yield, got, ok)
		}
	}
}
