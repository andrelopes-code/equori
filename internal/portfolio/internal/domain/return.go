package domain

import (
	"math"
	"slices"
	"time"
)

// CashFlow is a dated amount seen by the investor: money put in is negative, money taken out and
// the closing value are positive.
type CashFlow struct {
	Date   time.Time
	Amount int64
}

const (
	minRate   = -0.9999
	maxRate   = 1000.0
	solverMax = 200
)

// AnnualReturnBP is the internal rate of return of the flows, annualized by days over 365 from
// the first flow, in basis points rounded half to even. ok is false when no money was put in,
// when there are fewer than two flows or when the rate lies outside [-99.99%, 100000%].
// The solver runs in floating point; the result leaves as an integer (investments design AG2).
func AnnualReturnBP(flows []CashFlow) (bp int, ok bool) {
	if len(flows) < 2 || !slices.ContainsFunc(flows, func(f CashFlow) bool { return f.Amount < 0 }) {
		return 0, false
	}
	sorted := slices.SortedStableFunc(slices.Values(flows), func(a, b CashFlow) int { return a.Date.Compare(b.Date) })
	first := sorted[0].Date
	value := func(rate float64) float64 {
		var sum float64
		for _, f := range sorted {
			years := f.Date.Sub(first).Hours() / 24 / 365
			sum += float64(f.Amount) / math.Pow(1+rate, years)
		}
		return sum
	}
	lo, hi := minRate, maxRate
	vlo, vhi := value(lo), value(hi)
	if vlo == 0 {
		return int(math.RoundToEven(lo * 10000)), true
	}
	if (vlo > 0) == (vhi > 0) {
		return 0, false
	}
	for range solverMax {
		mid := (lo + hi) / 2
		vm := value(mid)
		if (vm > 0) == (vlo > 0) {
			lo, vlo = mid, vm
		} else {
			hi = mid
		}
	}
	return int(math.RoundToEven((lo + hi) / 2 * 10000)), true
}
