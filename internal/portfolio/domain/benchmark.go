package domain

import (
	"math"
	"slices"
	"time"
)

const (
	minPercent = -10.0
	maxPercent = 10.0

	// MaxPercentErrorBP is the largest PercentErrorBP at which a percent of an index is shown.
	MaxPercentErrorBP = 500

	// MinPercentDays is the fewest compared index days at which a rate profile shows a percent:
	// with fewer, the timing of one credit moves the percent by 1/days (R22).
	MinPercentDays = 5

	// maxCreditGap is the longest gap between two credits that a flow inside does not restart.
	maxCreditGap = 7 * 24 * time.Hour

	// maxAnnualBP bounds the rate a year AnnualBP returns: 10^7 basis points, 1,000,000%.
	maxAnnualBP = 1e7
)

// Subperiod is the end of one piece of a time-weighted period: the value of the tree at the end
// of a day, that day's flows included, and the sum of that day's flows.
type Subperiod struct {
	Value, Flow int64
}

// PeriodFactor is 1 plus the time-weighted return from the start value through ends, oldest
// first (amendment A208 R1). A flow earns from the day after it. ok is false when a gain has no
// invested base or when a piece loses everything.
func PeriodFactor(start int64, ends []Subperiod) (factor float64, ok bool) {
	return periodFactor(start, ends, false)
}

// RecordedPeriodFactor is PeriodFactor for a tree whose only gain is recorded yield: a piece that
// starts at 0 holds no money, so its gain contributes a factor of 1 (amendment A208 R20).
func RecordedPeriodFactor(start int64, ends []Subperiod) (factor float64, ok bool) {
	return periodFactor(start, ends, true)
}

// ComparisonStart is A of amendment A208 R20: the first of the credits, moved to the credit that
// ends the last gap of more than 7 days between two credits that holds a flow. credits are sorted,
// distinct and not empty.
func ComparisonStart(credits, flows []time.Time) (start time.Time, restarted bool) {
	start = credits[0]

	for i := 0; i+1 < len(credits); i++ {
		before, after := credits[i], credits[i+1]
		if after.Sub(before) <= maxCreditGap {
			continue
		}

		if slices.ContainsFunc(flows, func(f time.Time) bool { return f.After(before) && f.Before(after) }) {
			start, restarted = after, true
		}
	}

	return start, restarted
}

// PercentErrorBP is the relative bound of the percent of an index, in basis points: each of the
// credits is rounded to half a minor unit, so the credited yield is off by at most credits / 2 of
// yield minor units (amendment A208 R22). ok is false without a positive yield.
func PercentErrorBP(credits int, yield int64) (bp int, ok bool) {
	if yield <= 0 {
		return 0, false
	}

	return int((5000*int64(credits) + yield - 1) / yield), true
}

func periodFactor(start int64, ends []Subperiod, zeroBase bool) (factor float64, ok bool) {
	factor = 1

	for _, e := range ends {
		gain := e.Value - e.Flow - start
		if start <= 0 && gain != 0 && (!zeroBase || start != 0) {
			return 0, false
		}

		if start > 0 {
			factor *= 1 + float64(gain)/float64(start)
		}

		if factor <= 0 {
			return 0, false
		}

		start = e.Value
	}

	return factor, true
}

// FactorBP is factor − 1 in basis points, rounded half to even.
func FactorBP(factor float64) int { return int(math.RoundToEven((factor - 1) * 10000)) }

// IndexFactor is the growth of one unit at the rates: the product of 1 + rate.
func IndexFactor(rates []float64) float64 { return percentFactor(1, rates) }

// IndexPercentBP is the percent p of the index, in basis points of 100%, for which the product of
// 1 + p × rate equals factor (amendment A208 R5). ok is false when a rate is not positive or no p
// in [-1000%, 1000%] solves it. The solver runs in floating point; the result leaves as an
// integer (investments design AG2).
func IndexPercentBP(factor float64, rates []float64) (bp int, ok bool) {
	if len(rates) == 0 || slices.ContainsFunc(rates, func(r float64) bool { return r <= 0 }) {
		return 0, false
	}

	lo, hi := minPercent, maxPercent
	if percentFactor(lo, rates) > factor || percentFactor(hi, rates) < factor {
		return 0, false
	}

	for range solverMax {
		mid := (lo + hi) / 2
		if percentFactor(mid, rates) < factor {
			lo = mid
		} else {
			hi = mid
		}
	}

	return int(math.RoundToEven((lo + hi) / 2 * 10000)), true
}

// AnnualBP is the rate a year equivalent to growing by factor over days rate days, on a year of
// basis rate days: (factor^(basis/days) − 1) × 10000, rounded half to even (amendment A208 R9).
// ok is false without a day, without a basis, when factor is not positive, or when the result is
// not finite or lies outside ±10^7 basis points.
func AnnualBP(factor float64, days, basis int) (bp int, ok bool) {
	if days <= 0 || basis <= 0 || factor <= 0 {
		return 0, false
	}

	annual := (math.Pow(factor, float64(basis)/float64(days)) - 1) * 10000
	if math.IsNaN(annual) || math.IsInf(annual, 0) || math.Abs(annual) > maxAnnualBP {
		return 0, false
	}

	return int(math.RoundToEven(annual)), true
}

// RealBP is the return net of inflation, ((returnFactor / inflationFactor) − 1) × 10000 rounded
// half to even (Fisher, amendment A208 R16). ok is false when a factor is not positive.
func RealBP(returnFactor, inflationFactor float64) (bp int, ok bool) {
	if returnFactor <= 0 || inflationFactor <= 0 {
		return 0, false
	}

	return FactorBP(returnFactor / inflationFactor), true
}

// WholeMonths returns the calendar months that lie whole inside [from, to], from the first one up
// to the month before the first without a rate in rates (keyed by the first day of the month),
// and the rates of those months (amendment A208 R16). ok is false without such a month.
func WholeMonths(from, to time.Time, rates map[time.Time]float64) (first, until time.Time, monthly []float64, ok bool) {
	first = time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	if !first.Equal(from) {
		first = first.AddDate(0, 1, 0)
	}

	for m := first; !m.AddDate(0, 1, -1).After(to); m = m.AddDate(0, 1, 0) {
		r, rated := rates[m]
		if !rated {
			break
		}

		monthly = append(monthly, r)
		until = m.AddDate(0, 1, -1)
	}

	return first, until, monthly, len(monthly) > 0
}

// percentFactor is the product of 1 + p × rate; a factor at or below zero is minus infinity, so
// the product keeps growing with p.
func percentFactor(p float64, rates []float64) float64 {
	f := 1.0
	for _, r := range rates {
		step := 1 + p*r
		if step <= 0 {
			return math.Inf(-1)
		}

		f *= step
	}

	return f
}
