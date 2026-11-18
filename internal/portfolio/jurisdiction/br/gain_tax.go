package br

import (
	"math/big"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// The monthly tax on the gains of variable income (monthly gain tax design GT1 to GT5).
const (
	// stockExemption is the gross stock sales of a month, in cents, at or below which their gain
	// is exempt (Lei 11.033/2004 art. 3, I).
	stockExemption = 2000000
	// minimumDarf is the smallest DARF, in cents (Lei 9.430/1996 art. 68).
	minimumDarf = 1000
)

// poolRate is the rate of each pool in basis points: 15% for ordinary operations (Lei 11.033/2004
// art. 2), 20% for a day trade (art. 2, §1) and for FII units (Lei 8.668/1993 art. 18).
var poolRate = map[string]int{
	domain.PoolOrdinary: 1500,
	domain.PoolDayTrade: 2000,
	domain.PoolFII:      2000,
}

// variableIncome are the classes whose sales the monthly tax reads, apart from fii.
var variableIncome = []string{"stock", "etf", "bdr", "option"}

// GainTax returns the tax of each month with sales of variable income, in order (GT1 to GT5).
func (Jurisdiction) GainTax(sales []domain.TaxSale) []domain.TaxMonth {
	byMonth := map[time.Time][]domain.TaxSale{}
	for _, s := range sales {
		if poolOf(s) != "" {
			byMonth[s.Month] = append(byMonth[s.Month], s)
		}
	}

	months := make([]time.Time, 0, len(byMonth))
	for m := range byMonth {
		months = append(months, m)
	}

	slices.SortFunc(months, time.Time.Compare)

	c := carry{loss: map[string]int64{}, withheld: map[string]int64{}}
	out := make([]domain.TaxMonth, 0, len(months))

	for _, m := range months {
		out = append(out, c.month(m, byMonth[m]))
	}

	return out
}

// carry is what a month leaves to the next: the loss of each pool, the tax withheld beyond the
// tax of each pool within the year, and a DARF below the minimum.
type carry struct {
	loss, withheld map[string]int64
	darf           int64
	year           int
}

func (c *carry) month(m time.Time, sales []domain.TaxSale) domain.TaxMonth {
	if m.Year() != c.year {
		c.year = m.Year()
		clear(c.withheld)
	}

	exempt := stockSales(sales) <= stockExemption
	month := domain.TaxMonth{Month: m, CarriedIn: c.darf}
	total := c.darf

	for _, pool := range []string{domain.PoolOrdinary, domain.PoolDayTrade, domain.PoolFII} {
		line, ok := c.line(pool, sales, exempt)
		if !ok {
			continue
		}

		month.Lines = append(month.Lines, line)
		total += line.Due
	}

	if total < minimumDarf {
		c.darf = total
	} else {
		month.Darf, c.darf = total, 0
	}

	return month
}

// line computes one pool of the month; false when the month has no sale of it.
func (c *carry) line(pool string, sales []domain.TaxSale, exempt bool) (domain.TaxLine, bool) {
	l := domain.TaxLine{Pool: pool, RateBP: poolRate[pool]}
	found := false

	for _, s := range sales {
		if poolOf(s) != pool {
			continue
		}

		found = true
		l.Gross += s.Gross
		l.Withheld += s.Withheld

		if exempt && pool == domain.PoolOrdinary && s.TaxClass == "stock" && s.Result > 0 {
			l.Exempt += s.Result
			continue
		}

		l.Result += s.Result
	}

	if !found {
		return l, false
	}

	if l.Result < 0 {
		c.loss[pool] -= l.Result
	} else {
		l.LossUsed = min(c.loss[pool], l.Result)
		c.loss[pool] -= l.LossUsed
		l.Base = l.Result - l.LossUsed
	}

	l.LossCarried = c.loss[pool]
	l.Tax = percentOf(l.Base, l.RateBP)

	withheld := l.Withheld + c.withheld[pool]
	l.Due = max(l.Tax-withheld, 0)
	c.withheld[pool] = max(withheld-l.Tax, 0)

	return l, true
}

// poolOf names the pool of a sale; "" for a class the monthly tax does not read.
func poolOf(s domain.TaxSale) string {
	switch {
	case s.TaxClass == "fii":
		return domain.PoolFII
	case !slices.Contains(variableIncome, s.TaxClass):
		return ""
	case s.Kind == domain.KindDayTrade:
		return domain.PoolDayTrade
	}

	return domain.PoolOrdinary
}

// stockSales is the gross value of the ordinary sales of stocks of a month (GT2).
func stockSales(sales []domain.TaxSale) int64 {
	var total int64

	for _, s := range sales {
		if s.TaxClass == "stock" && s.Kind != domain.KindDayTrade {
			total += s.Gross
		}
	}

	return total
}

// percentOf is amount × bp ÷ 10000, rounded half to even to the minor unit (GT4).
func percentOf(amount int64, bp int) int64 {
	q, r := new(big.Int).QuoRem(
		new(big.Int).Mul(big.NewInt(amount), big.NewInt(int64(bp))),
		big.NewInt(10000),
		new(big.Int),
	)

	twice := new(big.Int).Mul(r, big.NewInt(2))
	if c := twice.Cmp(big.NewInt(10000)); c > 0 || (c == 0 && q.Bit(0) == 1) {
		q.Add(q, big.NewInt(1))
	}

	return q.Int64()
}
