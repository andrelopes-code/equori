package domain

import (
	"testing"
	"time"
)

// TestRiskSpans checks RK5, RK6 and RK8; the expected values were derived with exact fractions.
func TestRiskSpans(t *testing.T) {
	t.Parallel()

	months := []MonthValue{
		{End: day("2026-01-31"), Value: 103000, Flows: []CashFlow{flow("2026-01-01", 100000)}},
		{End: day("2026-02-28"), Value: 98000},
		{End: day("2026-03-31"), State: MonthStale},
		{End: day("2026-04-30"), Value: 100940, Flows: []CashFlow{flow("2026-04-15", -2000)}},
	}

	got := Risk(day("2025-12-31"), 0, months)

	tests := []struct {
		state    string
		returnBP int
		span     int
		drawdown int
	}{
		{MonthKnown, 310, 1, 0},
		{MonthKnown, -485, 1, -485},
		{MonthStale, 0, 0, 0},
		{MonthKnown, 507, 2, -3},
	}
	for i, want := range tests {
		m := got[i]
		if m.State != want.state || BP(m.Return) != want.returnBP || m.Span != want.span ||
			BP(m.Drawdown) != want.drawdown {
			t.Errorf("month %d = %s %d bp span %d drawdown %d, want %+v",
				i, m.State, BP(m.Return), m.Span, BP(m.Drawdown), want)
		}
	}
}

func TestRiskStates(t *testing.T) {
	t.Parallel()

	// A deposit spent on the same day leaves no base and no gain: the month holds nothing.
	months := []MonthValue{
		{
			End:   day("2026-01-31"),
			Flows: []CashFlow{flow("2026-01-02", 500), flow("2026-01-02", -500)},
		},
		{End: day("2026-02-28"), Value: 0, Flows: []CashFlow{flow("2026-02-01", -2000)}},
		{End: day("2026-03-31"), Value: 1100, Flows: []CashFlow{flow("2026-03-31", 1000)}},
		{End: day("2026-04-30"), Value: 1210},
	}

	got := Risk(day("2025-12-31"), 0, months)

	// The first month holds nothing; the second has no base; the third has a base of the flow
	// of its last day only (weight 0), so it has no base either; the drawdown restarts after it.
	want := []string{MonthNothingHeld, MonthNoBase, MonthNoBase, MonthKnown}
	for i, state := range want {
		if got[i].State != state {
			t.Errorf("month %d state = %s, want %s", i, got[i].State, state)
		}
	}

	if !got[3].HasDrawdown || BP(got[3].Drawdown) != 0 || BP(got[3].Return) != 1000 {
		t.Errorf("month 3 = return %d drawdown %d (%v), want 1000 and 0 after a restart",
			BP(got[3].Return), BP(got[3].Drawdown), got[3].HasDrawdown)
	}
}

// TestRiskVolatility checks RK7: twelve returns of +1% and -1% give 0.01 × √(12/11) × √12.
func TestRiskVolatility(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		months int
		wantBP int
		wantN  int
	}{
		{"eleven returns stay below the floor", 11, 0, 0},
		{"twelve returns", 12, 362, 12},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := Risk(day("2025-12-31"), 100000, alternating(tt.months))
			last := got[len(got)-1]

			if BP(last.Volatility) != tt.wantBP || last.VolatilityMonths != tt.wantN {
				t.Errorf("volatility = %d bp over %d, want %d over %d",
					BP(last.Volatility), last.VolatilityMonths, tt.wantBP, tt.wantN)
			}
		})
	}
}

// TestRiskCorrelation checks RK9 on returns of 1% to 12% against twice and minus them.
func TestRiskCorrelation(t *testing.T) {
	t.Parallel()

	a := returns(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)

	tests := []struct {
		name   string
		b      []MonthRisk
		wantBP int
		wantOK bool
	}{
		{"twice", returns(2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24), 10000, true},
		{"opposite", returns(-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12), -10000, true},
		{"eleven common months", append(returns(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11), MonthRisk{}),
			0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, n, ok := Correlation(a, tt.b)
			if ok != tt.wantOK || (ok && (BP(got) != tt.wantBP || n != 12)) {
				t.Errorf("correlation = %d bp over %d (%v), want %d (%v)",
					BP(got), n, ok, tt.wantBP, tt.wantOK)
			}
		})
	}
}

// TestRiskShares checks RK10: a class without gain carries no risk, and the shares sum to 1.
func TestRiskShares(t *testing.T) {
	t.Parallel()

	portfolio := returns(1, -2, 3, -1, 2, -3, 1, 2, -2, 3, -1, 1)
	for i := range portfolio {
		portfolio[i].Base = 1000
	}

	moving := make([]MonthRisk, len(portfolio))
	still := make([]MonthRisk, len(portfolio))

	for i, m := range portfolio {
		moving[i] = MonthRisk{State: MonthKnown, Span: 1, Gain: m.Return * 1000}
		still[i] = MonthRisk{State: MonthKnown, Span: 1}
	}

	got, ok := RiskShares([][]MonthRisk{moving, still}, portfolio)

	if !ok || BP(got[0]) != 10000 || BP(got[1]) != 0 {
		t.Errorf("shares = %v (%v), want 10000 and 0", got, ok)
	}
}

func flow(d string, amount int64) CashFlow {
	return CashFlow{Date: day(d), Amount: amount}
}

// alternating is n months of a value that rises 1% and falls 1% in turn, from 100000.
func alternating(n int) []MonthValue {
	months := make([]MonthValue, n)
	end := day("2026-01-31")
	value := 100000.0

	for i := range n {
		if i%2 == 0 {
			value *= 1.01
		} else {
			value *= 0.99
		}

		months[i] = MonthValue{End: end, Value: int64(value)}
		end = end.AddDate(0, 0, 1).AddDate(0, 1, -1)
	}

	return months
}

// returns builds one-month known returns, in percent.
func returns(percents ...float64) []MonthRisk {
	out := make([]MonthRisk, len(percents))
	for i, p := range percents {
		out[i] = MonthRisk{End: time.Time{}, State: MonthKnown, Span: 1, Return: p / 100}
	}

	return out
}
