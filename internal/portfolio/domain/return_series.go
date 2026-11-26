package domain

import (
	"slices"
	"time"
)

// MaxSeriesSteps is the most step dates a return series holds (portfolio results PS2).
const MaxSeriesSteps = 400

// StepDates lists the step dates of [from, to], oldest first, to included: every day ("day"),
// every seventh day counted back from to ("week"), or the last day of each calendar month and to
// ("month"). ok is false when from is after to, the step is unknown or the dates exceed
// MaxSeriesSteps (portfolio results PS2).
func StepDates(from, to time.Time, step string) (dates []time.Time, ok bool) {
	if from.After(to) {
		return nil, false
	}

	switch step {
	case "day":
		dates = backFrom(from, to, 1)
	case "week":
		dates = backFrom(from, to, 7)
	case "month":
		dates = monthEnds(from, to)
	default:
		return nil, false
	}

	if len(dates) > MaxSeriesSteps {
		return nil, false
	}

	return dates, true
}

// WholeMonthGrowth lists, for the consecutive whole calendar months of [from, to] that hold a
// rate, the last day of each month and the growth of the rates up to it; it stops at the first
// month without a rate. byMonth is keyed by the first day of the month (portfolio results PS5).
func WholeMonthGrowth(
	from, to time.Time,
	byMonth map[time.Time]float64,
) (ends []time.Time, factors []float64) {
	factor := 1.0

	for first := firstWholeMonth(from); !monthEnd(first).After(to); first = first.AddDate(0, 1, 0) {
		rate, found := byMonth[first]
		if !found {
			break
		}

		factor *= 1 + rate

		ends = append(ends, monthEnd(first))
		factors = append(factors, factor)
	}

	return ends, factors
}

// backFrom lists to, to-every, ... down to from, oldest first. It stops one date past
// MaxSeriesSteps so that a wide period is not enumerated.
func backFrom(from, to time.Time, every int) []time.Time {
	var dates []time.Time

	for d := to; !d.Before(from) && len(dates) <= MaxSeriesSteps; d = d.AddDate(0, 0, -every) {
		dates = append(dates, d)
	}

	slices.Reverse(dates)

	return dates
}

func monthEnds(from, to time.Time) []time.Time {
	var dates []time.Time

	first := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	for end := monthEnd(first); end.Before(to) && len(dates) <= MaxSeriesSteps; {
		if !end.Before(from) {
			dates = append(dates, end)
		}

		first = first.AddDate(0, 1, 0)
		end = monthEnd(first)
	}

	return append(dates, to)
}

func firstWholeMonth(from time.Time) time.Time {
	first := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	if from.After(first) {
		return first.AddDate(0, 1, 0)
	}

	return first
}

func monthEnd(first time.Time) time.Time {
	return first.AddDate(0, 1, -1)
}
