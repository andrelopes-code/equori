package app

import (
	"reflect"
	"testing"
	"time"
)

func month(s string) time.Time {
	m, err := time.Parse("2006-01", s)
	if err != nil {
		panic(err)
	}
	return m
}

// facts builds n consecutive months from from; fill sets the amounts of entry i.
func facts(from string, n int, fill func(i int, f *MonthFacts)) []MonthFacts {
	out := make([]MonthFacts, n)
	for i := range out {
		out[i].Month = month(from).AddDate(0, i, 0)
		if fill != nil {
			fill(i, &out[i])
		}
	}
	return out
}

func bp(v int64) Ratio { return Ratio{BP: v} }

func because(r Reason) Ratio { return Ratio{Reason: r} }

func repeat(r Ratio, n int) []Ratio {
	out := make([]Ratio, n)
	for i := range out {
		out[i] = r
	}
	return out
}

// between reports whether f's month lies in [from, to].
func between(f *MonthFacts, from, to string) bool {
	return !f.Month.Before(month(from)) && !f.Month.After(month(to))
}

// s154 holds the facts of scenario S154, 24 months ending 2026-10.
func s154() []MonthFacts {
	return facts("2024-11", 24, func(_ int, f *MonthFacts) {
		switch {
		case between(f, "2026-04", "2026-06"):
			f.Income, f.Expense = 500000, 250000
		case between(f, "2026-07", "2026-09"):
			f.Income, f.Expense = 500000, 285000
		case f.Month.Equal(month("2026-10")):
			f.Income, f.Expense, f.DebtService = 500000, 285000, 125000
			f.Committed, f.Liquid, f.Liabilities = 5000, 1790000, 640000
		}
	})
}

// Analytics design 4.2.
func TestIndicatorMonths(t *testing.T) {
	t.Parallel()
	t.Run("S154", func(t *testing.T) {
		t.Parallel()
		got := indicatorMonths(s154(), month("2026-04"))
		want := IndicatorMonth{
			Month: month("2026-10"), Income: 500000, Expense: 285000, Committed: 5000, DebtService: 125000,
			Liquid: 1790000, Liabilities: 640000, HasMeans: true, MeanIncome: 500000, MeanExpense: 267500,
			SavingsRate: bp(4300), TrailingSavingsRate: bp(4650), Liquidity: bp(66915),
			CommittedShare: bp(100), DebtServiceShare: bp(2500),
		}
		if len(got) != 12 || !reflect.DeepEqual(got[11], want) {
			t.Fatalf("last month = %+v, want %+v", got[len(got)-1], want)
		}
		if !got[0].Month.Equal(month("2025-11")) {
			t.Fatalf("first month = %v", got[0].Month)
		}
	})
	t.Run("S154 series", func(t *testing.T) {
		t.Parallel()
		got := indicatorMonths(s154(), month("2026-04"))
		var savings, trailing []Ratio
		for _, m := range got {
			savings, trailing = append(savings, m.SavingsRate), append(trailing, m.TrailingSavingsRate)
		}
		wantSavings := append(append(repeat(because(ReasonNoIncome), 5), repeat(bp(5000), 3)...), repeat(bp(4300), 4)...)
		wantTrailing := append(repeat(because(ReasonInsufficientHistory), 8), bp(5000), bp(4825), bp(4720), bp(4650))
		if !reflect.DeepEqual(savings, wantSavings) {
			t.Errorf("savings rates = %v, want %v", savings, wantSavings)
		}
		if !reflect.DeepEqual(trailing, wantTrailing) {
			t.Errorf("trailing savings rates = %v, want %v", trailing, wantTrailing)
		}
	})
	cases := []struct {
		name  string
		facts []MonthFacts
		first time.Time
		check func(t *testing.T, m IndicatorMonth)
	}{
		{
			name:  "no posting",
			facts: facts("2024-11", 24, nil),
			check: func(t *testing.T, m IndicatorMonth) {
				short := because(ReasonInsufficientHistory)
				if m.SavingsRate != because(ReasonNoIncome) || m.TrailingSavingsRate != short || m.Liquidity != short ||
					m.CommittedShare != short || m.DebtServiceShare != short || m.HasMeans || m.MeanIncome != 0 {
					t.Errorf("month = %+v", m)
				}
			},
		},
		{
			name: "two months of history",
			facts: facts("2024-11", 24, func(_ int, f *MonthFacts) {
				if between(f, "2026-08", "2026-10") {
					f.Income, f.Expense = 100000, 50000
				}
			}),
			first: month("2026-08"),
			check: func(t *testing.T, m IndicatorMonth) {
				short := because(ReasonInsufficientHistory)
				if m.TrailingSavingsRate != short || m.Liquidity != short {
					t.Errorf("month = %+v", m)
				}
			},
		},
		{
			name: "no expense (S156)",
			facts: facts("2024-11", 24, func(_ int, f *MonthFacts) {
				if between(f, "2026-07", "2026-10") {
					f.Income = 500000
				}
			}),
			first: month("2026-07"),
			check: func(t *testing.T, m IndicatorMonth) {
				if m.SavingsRate != bp(10000) || m.TrailingSavingsRate != bp(10000) ||
					m.Liquidity != because(ReasonNoExpense) || m.CommittedShare != bp(0) || m.DebtServiceShare != bp(0) {
					t.Errorf("month = %+v", m)
				}
			},
		},
		{
			name: "expense above income",
			facts: facts("2024-11", 24, func(_ int, f *MonthFacts) {
				if between(f, "2026-04", "2026-10") {
					f.Income, f.Expense = 3, 4
				}
			}),
			first: month("2026-04"),
			check: func(t *testing.T, m IndicatorMonth) {
				if m.SavingsRate != bp(-3333) || m.TrailingSavingsRate != bp(-3333) {
					t.Errorf("month = %+v", m)
				}
			},
		},
		{
			name: "months before first ignored",
			facts: facts("2024-11", 24, func(_ int, f *MonthFacts) {
				switch {
				case between(f, "2026-01", "2026-03"):
					f.Income = 900000
				case between(f, "2026-04", "2026-10"):
					f.Income, f.Expense = 500000, 250000
				}
			}),
			first: month("2026-04"),
			check: func(t *testing.T, m IndicatorMonth) {
				if m.TrailingSavingsRate != bp(5000) {
					t.Errorf("month = %+v", m)
				}
			},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			got := indicatorMonths(c.facts, c.first)
			if len(got) != 12 || !got[11].Month.Equal(month("2026-10")) {
				t.Fatalf("months = %+v", got)
			}
			c.check(t, got[11])
		})
	}
}
