package domain

import (
	"math/big"
	"time"
)

const (
	maxPriceAge   = 10
	minRangeYears = 3
	sharesInLots  = 1000
)

var (
	// countTolerance is the least ratio of a count and the filed shares that agree (AC1).
	countTolerance = big.NewRat(9, 10)
	// A ratio of two successive prices outside these is a split the filings may not state (AC6).
	jumpDown = big.NewRat(55, 100)
	jumpUp   = big.NewRat(18, 10)
	// minorityLimit is the part of the equity of other holders up to which the whole net income
	// stands for the parent's (AC2).
	minorityLimit = big.NewRat(1, percentRat)
)

// multiples sets the price multiples, their ranges and the date of the price (AC4 to AC7).
func (c company) multiples(out *CompanyFigures) {
	out.PriceEarningsRange, out.PriceBookRange = c.ranges()

	value, reason := c.currentValue(out)
	if reason != "" {
		out.PriceEarnings = Figure{Reason: reason}
		out.PriceBook = out.PriceEarnings

		return
	}

	out.PriceEarnings = c.priceEarnings(value)
	out.PriceBook = priceBook(value, *c.newest)
}

// currentValue is the market value at the price asked, with the date of the price set on out, or
// the reason the multiples have none.
func (c company) currentValue(out *CompanyFigures) (*big.Rat, string) {
	if c.newest == nil {
		return nil, ReasonMissing
	}

	price, reason := c.price()
	if price != nil {
		out.PriceDate = &price.Date
	}

	switch {
	case stale(c.newest.Period, c.in.PriceDate):
		return nil, ReasonStale
	case c.in.Report.SharesPerUnit == nil:
		return nil, ReasonUnit
	case reason != "":
		return nil, reason
	}

	shares, reason := c.verifiedShares(*c.newest)
	if reason != "" {
		return nil, reason
	}

	return c.marketValue(price.Value, shares), ""
}

// price is the chosen price of AC6; the reason is empty when the multiples may read it.
func (c company) price() (*CompanyPrice, string) {
	if len(c.in.Prices) == 0 {
		return nil, ReasonNoPrice
	}

	last := c.in.Prices[len(c.in.Prices)-1]
	if c.in.PriceDate.Sub(last.Date) > maxPriceAge*24*time.Hour {
		return nil, ReasonNoPrice
	}

	before := (*big.Rat)(nil)

	for _, p := range c.in.Prices {
		if p.Date.Before(c.newest.Period) {
			continue
		}

		if before != nil {
			ratio := new(big.Rat).Quo(p.Value, before)
			if ratio.Cmp(jumpDown) < 0 || ratio.Cmp(jumpUp) > 0 {
				return &last, ReasonPriceJump
			}
		}

		before = p.Value
	}

	return &last, ""
}

// verifiedShares returns the outstanding shares of p, or the reason they are not verified (AC1).
func (c company) verifiedShares(p CompanyReportPeriod) (*big.Rat, string) {
	if p.ClassesDiffer {
		return nil, ReasonClasses
	}

	if p.SharesIssued == nil || *p.SharesIssued <= 0 {
		return nil, ReasonShares
	}

	for _, k := range []int64{1, sharesInLots} {
		for _, year := range []int{p.Period.Year(), p.Period.Year() + 1} {
			count := c.in.Report.ShareCounts[year]
			if !agrees(count, *p.SharesIssued, k) {
				continue
			}

			outstanding := outstandingShares(p, count, k)
			if outstanding <= 0 {
				return nil, ReasonShares
			}

			return new(big.Rat).Mul(big.NewRat(outstanding, 1), big.NewRat(k, 1)), ""
		}
	}

	return nil, ReasonShares
}

// outstandingShares subtracts the treasury, unless the count shows that the filed shares are
// already net of it.
func outstandingShares(p CompanyReportPeriod, count, k int64) int64 {
	if p.SharesTreasury == nil {
		return *p.SharesIssued
	}

	gross := new(big.Int).Sub(big.NewInt(count), product(*p.SharesIssued, k))
	net := new(big.Int).Sub(gross, product(*p.SharesTreasury, k))

	if net.CmpAbs(gross) < 0 {
		return *p.SharesIssued
	}

	return *p.SharesIssued - *p.SharesTreasury
}

func product(a, b int64) *big.Int { return new(big.Int).Mul(big.NewInt(a), big.NewInt(b)) }

// agrees reports whether count and the filed shares times k are within the tolerance.
func agrees(count, filed, k int64) bool {
	if count <= 0 {
		return false
	}

	ratio := new(big.Rat).Quo(
		big.NewRat(count, 1),
		new(big.Rat).Mul(big.NewRat(filed, 1), big.NewRat(k, 1)),
	)

	return ratio.Cmp(countTolerance) >= 0 && ratio.Cmp(new(big.Rat).Inv(countTolerance)) <= 0
}

// marketValue is the price of every share in minor units.
func (c company) marketValue(price, shares *big.Rat) *big.Rat {
	value := new(big.Rat).Mul(price, shares)
	value.Mul(value, big.NewRat(c.in.MinorPerUnit, 1))

	return value.Quo(value, big.NewRat(int64(*c.in.Report.SharesPerUnit), 1))
}

// priceEarnings divides the market value by the profit of the parent of the first window that
// gives it (AC3, AC4).
func (c company) priceEarnings(value *big.Rat) Figure {
	first := ""

	for _, p := range append(append([]CompanyReportPeriod{}, c.partial...), c.years[0]) {
		income, reason := c.parentIncome(p)
		if reason == "" && stale(p.Period, c.in.PriceDate) {
			reason = ReasonStale
		}

		switch {
		case reason == "" && income.Sign() <= 0:
			return Figure{Reason: ReasonLoss}
		case reason == "":
			return Figure{Value: new(big.Rat).Quo(value, income), Date: p.Period}
		case first == "":
			first = reason
		}
	}

	return Figure{Reason: first}
}

// parentIncome is the profit of the parent over the window that ends at p (AC2).
func (c company) parentIncome(p CompanyReportPeriod) (*big.Rat, string) {
	periods, signs, ok := c.terms(p)
	if !ok {
		return nil, ReasonMissing
	}

	if income := sumTerms(periods, signs, filedParentIncome); income != nil {
		return income, ""
	}

	total := sumTerms(periods, signs, netIncomeOf)
	if total == nil {
		return nil, ReasonMissing
	}

	for _, t := range periods {
		if !smallMinority(t) {
			return nil, ReasonParentIncome
		}
	}

	return total, ""
}

// filedParentIncome is the profit of the parent; a zero is a line the filing left blank.
func filedParentIncome(p CompanyReportPeriod) *int64 {
	if p.NetIncomeParent == nil || *p.NetIncomeParent == 0 {
		return nil
	}

	return p.NetIncomeParent
}

func smallMinority(p CompanyReportPeriod) bool {
	if p.EquityMinority == nil || *p.EquityMinority == 0 {
		return true
	}

	if p.Equity == nil || *p.Equity <= 0 {
		return false
	}

	return big.NewRat(*p.EquityMinority, *p.Equity).Cmp(minorityLimit) <= 0
}

func priceBook(value *big.Rat, p CompanyReportPeriod) Figure {
	if p.Equity == nil {
		return Figure{Reason: ReasonMissing}
	}

	equity := *p.Equity
	if p.EquityMinority != nil {
		equity -= *p.EquityMinority
	}

	if equity <= 0 {
		return Figure{Reason: ReasonNegativeEquity}
	}

	return Figure{Value: new(big.Rat).Quo(value, big.NewRat(equity, 1)), Date: p.Period}
}

// ranges returns the ranges of the multiples over the latest fiscal years (AC7).
func (c company) ranges() (earnings, book *Range) {
	var pe, pb []*big.Rat

	for _, y := range c.years[:min(len(c.years), maxFiscalYears)] {
		price := c.in.YearPrices[y.Period]
		shares, reason := c.verifiedShares(y)

		if price == nil || reason != "" || c.in.Report.SharesPerUnit == nil {
			continue
		}

		value := c.marketValue(price, shares)

		if income, reason := c.parentIncome(y); reason == "" && income.Sign() > 0 {
			pe = append(pe, new(big.Rat).Quo(value, income))
		}

		if f := priceBook(value, y); f.Value != nil {
			pb = append(pb, f.Value)
		}
	}

	return rangeOf(pe), rangeOf(pb)
}

func rangeOf(values []*big.Rat) *Range {
	if len(values) < minRangeYears {
		return nil
	}

	out := &Range{Least: values[0], Greatest: values[0], Years: len(values)}

	for _, v := range values[1:] {
		if v.Cmp(out.Least) < 0 {
			out.Least = v
		}

		if v.Cmp(out.Greatest) > 0 {
			out.Greatest = v
		}
	}

	return out
}
