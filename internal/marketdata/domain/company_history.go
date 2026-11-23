package domain

import (
	"math"
	"math/big"
)

// revenueGrowth is the compound growth a year over the stored fiscal years (AC9). Its value is
// rounded; a comparison reads the terms.
func (c company) revenueGrowth() (Figure, Growth) {
	if c.in.Report.Plan != standardChart {
		return Figure{Reason: ReasonChart}, Growth{}
	}

	years := c.years[:min(len(c.years), maxFiscalYears)]
	if len(years) < minGrowthYears {
		return Figure{Reason: ReasonShortHistory}, Growth{}
	}

	last, first := years[0].Revenue, years[len(years)-1].Revenue
	if last == nil || first == nil || *last <= 0 || *first <= 0 {
		return Figure{Reason: ReasonMissing}, Growth{}
	}

	n := len(years) - 1
	rate := math.Pow(float64(*last)/float64(*first), 1/float64(n)) - 1
	value := new(big.Rat).SetFloat64(math.Round(rate*1e6) / 1e6)

	return Figure{Value: value, Date: years[0].Period}, Growth{First: first, Last: last, Years: n}
}

func (c company) positiveYears() PositiveYears {
	var out PositiveYears

	for _, y := range c.years[:min(len(c.years), maxFiscalYears)] {
		if y.NetIncome == nil {
			continue
		}

		out.Years++

		if *y.NetIncome > 0 {
			out.Positive++
		}
	}

	return out
}

// change compares the newest period with the same months of the year before (AC8).
func (c company) change(of account) Change {
	if c.newest == nil {
		return Change{Reason: ReasonShortHistory}
	}

	now, before := *c.newest, (*CompanyReportPeriod)(nil)

	switch {
	case now.Months != fiscalYearMonths:
		before = c.yearBefore(now)
	case len(c.years) > 1:
		before = &c.years[1]
	}

	if before == nil || of(now) == nil || of(*before) == nil {
		return Change{Reason: ReasonShortHistory}
	}

	out := Change{Date: now.Period, Months: now.Months}
	a, b := *of(now), *of(*before)

	switch {
	case a <= 0:
		out.State = ChangeLoss
	case b <= 0:
		out.State = ChangeTurned
	default:
		out.State = ChangeRate
		out.Rate = new(big.Rat).Sub(big.NewRat(a, b), big.NewRat(1, 1))
	}

	return out
}
