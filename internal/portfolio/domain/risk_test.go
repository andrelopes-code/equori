package domain

import (
	"testing"
	"time"
)

// TestRiskSpans checks RK5, RK6 and RK8; the expected values were derived with exact fractions.
// April spans two months without a price inside them, so it keeps the modified Dietz figure.
func TestRiskSpans(t *testing.T) {
	t.Parallel()

	months := []MonthValue{
		{
			End:   day("2026-01-31"),
			Value: 103000,
			Flows: []CashFlow{flow("2026-01-01", 100000)},
			Marks: []Mark{{Date: day("2026-01-01"), Value: 100000, Known: true}},
		},
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
		// January earns from the day after its deposit: 103000 / 100000 (RK5).
		{MonthKnown, 300, 1, 0},
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

// TestRiskDrawdownGap checks RK8: a month that leaves out more than the limit has no drawdown,
// and the run starts again after it.
func TestRiskDrawdownGap(t *testing.T) {
	t.Parallel()

	got := Finish([]MonthRisk{
		{State: MonthKnown, Span: 1, Return: -0.10},
		{State: MonthKnown, Span: 1, Return: -0.20, Excluded: 0.30},
		{State: MonthKnown, Span: 1, Return: -0.05},
		{State: MonthKnown, Span: 1, Return: -0.05, Excluded: 0.05},
	})

	want := []struct {
		has bool
		bp  int
	}{{true, -1000}, {false, 0}, {true, -500}, {true, -975}}
	for i, w := range want {
		if got[i].HasDrawdown != w.has || BP(got[i].Drawdown) != w.bp {
			t.Errorf("month %d drawdown = %d (%v), want %d (%v)",
				i, BP(got[i].Drawdown), got[i].HasDrawdown, w.bp, w.has)
		}
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

	percents := []float64{1, -2, 3, -1, 2, -3, 1, 2, -2, 3, -1, 1}
	moving := make([]MonthRisk, len(percents))
	still := make([]MonthRisk, len(percents))

	for i, p := range percents {
		moving[i] = MonthRisk{State: MonthKnown, Span: 1, Subs: []Sub{{Gain: p * 10, Base: 1000}}}
		still[i] = MonthRisk{State: MonthKnown, Span: 1, Subs: []Sub{{Base: 1000}}}
	}

	holdings := [][][]MonthRisk{{moving}, {still}}
	portfolio := Aggregate([][]MonthRisk{moving, still})

	got, ok := RiskShares(holdings, portfolio)

	if !ok || BP(got[0]) != 10000 || BP(got[1]) != 0 {
		t.Errorf("shares = %v (%v), want 10000 and 0", got, ok)
	}

	// Two moving classes over two periods a month: the linked contributions add up to the
	// portfolio's return each month, so the shares sum to 1.
	a := make([]MonthRisk, len(percents))
	b := make([]MonthRisk, len(percents))

	for i, p := range percents {
		a[i] = MonthRisk{State: MonthKnown, Span: 1, Subs: []Sub{
			{Gain: p * 10, Base: 1000}, {Gain: -p * 5, Base: 1000 + p*10},
		}}
		b[i] = MonthRisk{State: MonthKnown, Span: 1, Subs: []Sub{
			{Gain: p * 3, Base: 500}, {Gain: p * 8, Base: 500 + p*3},
		}}
	}

	shares, ok := RiskShares([][][]MonthRisk{{a}, {b}}, Aggregate([][]MonthRisk{a, b}))
	if !ok || BP(shares[0]+shares[1]) != 10000 {
		t.Errorf("shares = %v (%v), want a sum of 10000", shares, ok)
	}
}

// TestRiskTimeWeighted checks RK5: the value at each flow date splits the month, and the pieces
// chain, so a flow as large as the holding does not bend the return.
func TestRiskTimeWeighted(t *testing.T) {
	t.Parallel()

	// 100000 gains 10% to the 15th, then 100000 arrives; the 210000 lose 10% to the end:
	// 1.10 × 0.90 − 1 = −1%.
	months := []MonthValue{{
		End:   day("2026-01-31"),
		Value: 189000,
		Flows: []CashFlow{flow("2026-01-15", 100000)},
		Marks: []Mark{{Date: day("2026-01-15"), Value: 210000, Known: true}},
	}}

	got := Spans(day("2025-12-31"), 100000, months)[0]

	if got.State != MonthKnown || BP(got.Return) != -100 || len(got.Subs) != 2 {
		t.Errorf("month = %s %d bp, %d pieces; want -100 over 2", got.State, BP(got.Return),
			len(got.Subs))
	}

	// A mark without a price carries the value before it plus its flows: that piece returns 0,
	// and the month is (189000 − 200000) / 200000.
	months[0].Marks[0].Known = false
	if got := Spans(day("2025-12-31"), 100000, months)[0]; BP(got.Return) != -550 {
		t.Errorf("month without the mark's price = %d bp, want -550", BP(got.Return))
	}

	// The fund falls 10% after the 15th while the cash it received waits: the portfolio's
	// pieces are 10% and (99000 + 100000 − 210000) / 210000, chained: 424 basis points.
	fund := Spans(day("2025-12-31"), 100000, []MonthValue{{
		End:   day("2026-01-31"),
		Value: 99000,
		Marks: []Mark{{Date: day("2026-01-15"), Value: 110000, Known: true}},
	}})
	cash := Spans(day("2025-12-31"), 0, []MonthValue{{
		End:   day("2026-01-31"),
		Value: 100000,
		Flows: []CashFlow{flow("2026-01-15", 100000)},
		Marks: []Mark{{Date: day("2026-01-15"), Value: 100000, Known: true}},
	}})

	if p := Aggregate([][]MonthRisk{fund, cash})[0]; BP(p.Return) != 424 {
		t.Errorf("portfolio = %d bp, want 424", BP(p.Return))
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

// TestRiskAggregate checks RK3: a holding without a fresh price leaves its month, the others
// still make the month, and the share left out decides whether the month counts as one month.
func TestRiskAggregate(t *testing.T) {
	t.Parallel()

	start := day("2025-12-31")
	stale := Spans(start, 1000, []MonthValue{
		{End: day("2026-01-31"), Value: 1100},
		{End: day("2026-02-28"), State: MonthStale, Value: 1100},
		{End: day("2026-03-31"), Value: 1210},
	})

	tests := []struct {
		name     string
		other    int64
		excluded int
		counts   bool
		// March: the share of the stale holding, whose span of two months is left out.
		marchExcluded int
	}{
		// 1100 of 10100 is 1089 basis points left out: above the limit of 1000.
		{"a large share left out", 9000, 1089, false, 1089},
		// 1100 of 100100 is 110 basis points.
		{"a small share left out", 99000, 110, true, 110},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			grow := tt.other / 10
			other := Spans(start, tt.other, []MonthValue{
				{End: day("2026-01-31"), Value: tt.other},
				{End: day("2026-02-28"), Value: tt.other},
				{End: day("2026-03-31"), Value: tt.other + grow},
			})

			got := Aggregate([][]MonthRisk{stale, other})

			if got[1].State != MonthKnown || BP(got[1].Return) != 0 ||
				BP(got[1].Excluded) != tt.excluded || got[1].OneMonth() != tt.counts {
				t.Errorf(
					"february = %+v, want %d bp left out, counts %v",
					got[1],
					tt.excluded,
					tt.counts,
				)
			}

			// March is one month: the stale holding's return covers two, so it is left out and
			// the month holds the other holding's 10%.
			if got[2].Span != 1 || BP(got[2].Return) != 1000 ||
				BP(got[2].Excluded) != tt.marchExcluded || got[2].OneMonth() != tt.counts {
				t.Errorf(
					"march = %+v, want 1000 bp over one month, %d bp left out",
					got[2],
					tt.marchExcluded,
				)
			}
		})
	}

	// When every holding counted spans two months, the month carries the two (RK6).
	both := Aggregate([][]MonthRisk{stale, stale})
	if both[2].Span != 2 || BP(both[2].Return) != 1000 || both[2].Excluded != 0 {
		t.Errorf("march of two stale holdings = %+v, want 1000 bp over two months", both[2])
	}

	// A month whose every holding lacks a fresh price takes the worst state.
	alone := Aggregate([][]MonthRisk{stale})
	if alone[1].State != MonthStale {
		t.Errorf("february alone = %s, want stale", alone[1].State)
	}
}
