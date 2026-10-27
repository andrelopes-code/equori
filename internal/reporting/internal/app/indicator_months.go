package app

import (
	"math/big"
	"time"
)

// Reason states why an indicator ratio has no value (analytics design 4.2).
type Reason string

const (
	ReasonNoIncome            Reason = "no_income"
	ReasonNoExpense           Reason = "no_expense"
	ReasonInsufficientHistory Reason = "insufficient_history"
)

// Ratio holds BP when Reason is empty.
type Ratio struct {
	BP     int64
	Reason Reason
}

// MonthFacts are one month's amounts in the base currency's minor units. Committed, Liquid and
// Liabilities are read only for the 12 months returned.
type MonthFacts struct {
	Month                                                        time.Time
	Income, Expense, DebtService, Committed, Liquid, Liabilities int64
}

type IndicatorMonth struct {
	Month                                                        time.Time
	Income, Expense, Committed, DebtService, Liquid, Liabilities int64
	// HasMeans is false when the trailing window holds fewer than 3 months.
	HasMeans                                                                      bool
	MeanIncome, MeanExpense                                                       int64
	SavingsRate, TrailingSavingsRate, Liquidity, CommittedShare, DebtServiceShare Ratio
}

// minTrailingMonths is the shortest trailing window a trailing value needs (analytics design 4.1).
const minTrailingMonths = 3

// indicatorMonths turns 24 months of facts, oldest first, into the indicators of the last 12.
// first is the first posting month; the zero time means the user has no posting.
func indicatorMonths(facts []MonthFacts, first time.Time) []IndicatorMonth {
	if len(facts) != 24 {
		panic("indicatorMonths needs 24 months of facts")
	}
	out := make([]IndicatorMonth, 0, 12)
	for j := 12; j < 24; j++ {
		f := facts[j]
		m := IndicatorMonth{
			Month: f.Month, Income: f.Income, Expense: f.Expense, Committed: f.Committed,
			DebtService: f.DebtService, Liquid: f.Liquid, Liabilities: f.Liabilities,
			SavingsRate: share(f.Income-f.Expense, 1, f.Income, ReasonNoIncome),
		}
		var n, income, expense int64
		for _, w := range facts[j-12 : j] {
			if first.IsZero() || w.Month.Before(first) {
				continue
			}
			n++
			income += w.Income
			expense += w.Expense
		}
		if n < minTrailingMonths {
			short := Ratio{Reason: ReasonInsufficientHistory}
			m.TrailingSavingsRate, m.Liquidity, m.CommittedShare, m.DebtServiceShare = short, short, short, short
			out = append(out, m)
			continue
		}
		m.HasMeans, m.MeanIncome, m.MeanExpense = true, income/n, expense/n
		m.TrailingSavingsRate = share(income-expense, 1, income, ReasonNoIncome)
		m.Liquidity = share(f.Liquid, n, expense, ReasonNoExpense)
		m.CommittedShare = share(f.Committed, n, income, ReasonNoIncome)
		m.DebtServiceShare = share(f.DebtService, n, income, ReasonNoIncome)
		out = append(out, m)
	}
	return out
}

// share is value × 10000 × n ÷ total in basis points, truncated toward zero, or reason when
// total is not above zero.
func share(value, n, total int64, reason Reason) Ratio {
	if total <= 0 {
		return Ratio{Reason: reason}
	}
	q := new(big.Int).Mul(big.NewInt(value), big.NewInt(10000))
	q.Mul(q, big.NewInt(n))
	return Ratio{BP: q.Quo(q, big.NewInt(total)).Int64()}
}
