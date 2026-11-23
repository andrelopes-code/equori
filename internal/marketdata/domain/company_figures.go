package domain

import (
	"math/big"
	"slices"
	"time"
)

// account reads one account of a period.
type account func(p CompanyReportPeriod) *int64

// Figures computes the figures of a company from its filings and prices.
func Figures(in FigureInput) CompanyFigures {
	c := newCompany(in)
	out := CompanyFigures{
		ReturnOnEquity:      c.returnOnEquity(),
		NetMargin:           c.netMargin(),
		NetDebtToEquity:     c.netDebtToEquity(),
		GrossProfitToAssets: c.grossProfitToAssets(),
		CurrentRatio:        c.currentRatio(),
		PositiveYears:       c.positiveYears(),
		Profit:              c.change(netIncomeOf),
		Revenue:             c.change(revenueOf),
	}
	out.RevenueGrowth, out.Growth = c.revenueGrowth()
	c.multiples(&out)

	return out
}

// company is the periods of a report by kind, newest first.
type company struct {
	in    FigureInput
	years []CompanyReportPeriod
	// partial are the years to date after the latest fiscal year (CR7).
	partial []CompanyReportPeriod
	newest  *CompanyReportPeriod
}

func newCompany(in FigureInput) company {
	c := company{in: in}

	for _, p := range in.Report.Periods {
		if p.Months == fiscalYearMonths {
			c.years = append(c.years, p)
		}
	}

	byPeriod := func(a, b CompanyReportPeriod) int { return b.Period.Compare(a.Period) }
	slices.SortFunc(c.years, byPeriod)

	if len(c.years) == 0 {
		return c
	}

	start := c.years[0].Period.AddDate(0, 0, 1)

	for _, p := range in.Report.Periods {
		if p.Months != fiscalYearMonths && startOf(p).Equal(start) {
			c.partial = append(c.partial, p)
		}
	}

	slices.SortFunc(c.partial, byPeriod)

	c.newest = &c.years[0]
	if len(c.partial) > 0 {
		c.newest = &c.partial[0]
	}

	return c
}

// startOf is the first day of a period: the day after the end of the month Months before its end.
func startOf(p CompanyReportPeriod) time.Time {
	next := p.Period.AddDate(0, 0, 1)

	return next.AddDate(0, -p.Months, 0)
}

// yearBefore returns the year to date of the same months one year before p.
func (c company) yearBefore(p CompanyReportPeriod) *CompanyReportPeriod {
	end := p.Period.AddDate(0, 0, 1).AddDate(-1, 0, 0).AddDate(0, 0, -1)

	for _, o := range c.in.Report.Periods {
		if o.Months == p.Months && o.Period.Equal(end) {
			return &o
		}
	}

	return nil
}

// terms returns the periods of a window that ends at p and their signs: F, or F + Q - Q' (CR7).
func (c company) terms(p CompanyReportPeriod) ([]CompanyReportPeriod, []int64, bool) {
	if p.Months == fiscalYearMonths {
		return []CompanyReportPeriod{p}, []int64{1}, true
	}

	before := c.yearBefore(p)
	if before == nil {
		return nil, nil, false
	}

	return []CompanyReportPeriod{c.years[0], p, *before}, []int64{1, 1, -1}, true
}

// twelveMonths returns the flow over the window that ends at the newest period; nil when a term
// lacks the account (CR7).
func (c company) twelveMonths(of account) *big.Rat {
	periods, signs, ok := c.terms(*c.newest)
	if !ok {
		return nil
	}

	return sumTerms(periods, signs, of)
}

func sumTerms(periods []CompanyReportPeriod, signs []int64, of account) *big.Rat {
	sum := new(big.Rat)

	for i, p := range periods {
		v := of(p)
		if v == nil {
			return nil
		}

		sum.Add(sum, big.NewRat(signs[i]**v, 1))
	}

	return sum
}

// stale reports whether a window that ends at end is too old on date (AC3).
func stale(end, date time.Time) bool {
	return date.Sub(end) > maxBalanceAge*24*time.Hour
}

func (c company) returnOnEquity() Figure {
	return c.balanceRatio(false, func() (*big.Rat, *big.Rat, string) {
		return c.twelveMonths(netIncomeOf), rat(c.newest.Equity), ReasonNegativeEquity
	})
}

func (c company) netMargin() Figure {
	return c.balanceRatio(true, func() (*big.Rat, *big.Rat, string) {
		return c.twelveMonths(netIncomeOf), c.twelveMonths(revenueOf), ReasonMissing
	})
}

func (c company) netDebtToEquity() Figure {
	return c.balanceRatio(true, func() (*big.Rat, *big.Rat, string) {
		return rat(netDebtOf(*c.newest)), rat(c.newest.Equity), ReasonNegativeEquity
	})
}

func (c company) grossProfitToAssets() Figure {
	return c.balanceRatio(true, func() (*big.Rat, *big.Rat, string) {
		gross := c.twelveMonths(func(p CompanyReportPeriod) *int64 { return p.GrossProfit })

		return gross, rat(c.newest.TotalAssets), ReasonMissing
	})
}

func (c company) currentRatio() Figure {
	return c.balanceRatio(true, func() (*big.Rat, *big.Rat, string) {
		return rat(c.newest.CurrentAssets), rat(c.newest.CurrentLiabilities), ReasonMissing
	})
}

// balanceRatio divides the terms of the newest balance; standard limits it to the standard chart.
// A divisor at or below zero has the reason the terms name.
func (c company) balanceRatio(
	standard bool,
	terms func() (numerator, divisor *big.Rat, zero string),
) Figure {
	switch {
	case c.newest == nil:
		return Figure{Reason: ReasonMissing}
	case standard && c.in.Report.Plan != standardChart:
		return Figure{Reason: ReasonChart}
	case stale(c.newest.Period, c.in.Today):
		return Figure{Reason: ReasonStale}
	}

	numerator, divisor, zero := terms()

	switch {
	case numerator == nil || divisor == nil:
		return Figure{Reason: ReasonMissing}
	case divisor.Sign() <= 0:
		return Figure{Reason: zero}
	}

	return Figure{Value: numerator.Quo(numerator, divisor), Date: c.newest.Period}
}

func netIncomeOf(p CompanyReportPeriod) *int64 { return p.NetIncome }

func revenueOf(p CompanyReportPeriod) *int64 { return p.Revenue }

// netDebtOf is the debt less the cash; nil when an account is missing.
func netDebtOf(p CompanyReportPeriod) *int64 {
	if p.ShortDebt == nil || p.LongDebt == nil || p.Cash == nil || p.ShortInvestments == nil {
		return nil
	}

	debt := *p.ShortDebt + *p.LongDebt - *p.Cash - *p.ShortInvestments

	return &debt
}

func rat(v *int64) *big.Rat {
	if v == nil {
		return nil
	}

	return new(big.Rat).SetInt64(*v)
}
