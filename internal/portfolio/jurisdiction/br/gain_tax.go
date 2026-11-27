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
	// cryptoExemption is the crypto sales of a month, in cents, at or below which their gain is
	// exempt (the small-value rule of the capital gain, RFB on crypto assets).
	cryptoExemption = 3500000
)

// cryptoBrackets are the rates of a capital gain by its amount in cents (Lei 13.259/2016 art. 1):
// 15% to R$ 5 million, 17.5% to 10 million, 20% to 30 million, 22.5% above.
var cryptoBrackets = []struct {
	upTo int64
	bp   int
}{{500000000, 1500}, {1000000000, 1750}, {3000000000, 2000}, {1 << 62, 2250}}

// poolRate is the rate of each pool in basis points: 15% for ordinary operations (Lei 11.033/2004
// art. 2), 20% for a day trade (art. 2, §1) and for FII units (Lei 8.668/1993 art. 18).
var poolRate = map[string]int{
	domain.PoolOrdinary: 1500,
	domain.PoolDayTrade: 2000,
	domain.PoolFII:      2000,
	domain.PoolCrypto:   1500,
}

// variableIncome are the classes whose sales the monthly tax reads, apart from fii.
// A future pays the tax of variable income on the sum of its results (IN RFB 1.585/2015 art. 54).
var variableIncome = []string{"stock", "etf", "bdr", "option", "future"}

// GainTax returns the tax of each month with sales of variable income, in order (GT1 to GT5).
// An opening loss replaces the loss carried into its pool at the first month on or after its
// month with a sale of that pool (investment history LO3).
func (Jurisdiction) GainTax(
	sales []domain.TaxSale,
	opening []domain.OpeningLoss,
) []domain.TaxMonth {
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
		opening = c.open(m, byMonth[m], opening)
		out = append(out, c.month(m, byMonth[m]))
	}

	return out
}

// LossPools are the pools whose loss from before the book a person may type; crypto is left out
// since its loss reduces no gain (Lei 13.259/2016).
func (Jurisdiction) LossPools() []string {
	return []string{domain.PoolOrdinary, domain.PoolDayTrade, domain.PoolFII}
}

// open applies to the carry the opening losses that fall on or before m with a sale of their pool
// in sales, and returns the ones not yet applied.
func (c *carry) open(
	m time.Time,
	sales []domain.TaxSale,
	opening []domain.OpeningLoss,
) []domain.OpeningLoss {
	return slices.DeleteFunc(slices.Clone(opening), func(o domain.OpeningLoss) bool {
		if o.Month.After(m) || !slices.ContainsFunc(sales, func(s domain.TaxSale) bool {
			return poolOf(s) == o.Pool
		}) {
			return false
		}

		c.loss[o.Pool] = o.Amount

		return true
	})
}

// carry is what a month leaves to the next: the loss of each pool, the tax withheld beyond the
// tax of each pool within the year, and a DARF below the minimum.
type carry struct {
	loss, withheld   map[string]int64
	darf, cryptoDarf int64
	year             int
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

	c.crypto(&month, sales)

	return month
}

// crypto adds the line of the crypto pool and its own DARF (coverage row U-07): exempt up to
// cryptoExemption of sales; above it every gain is taxed by the brackets and no loss reduces it.
func (c *carry) crypto(month *domain.TaxMonth, sales []domain.TaxSale) {
	l := domain.TaxLine{Pool: domain.PoolCrypto, RateBP: poolRate[domain.PoolCrypto]}
	found := false

	for _, s := range sales {
		if poolOf(s) == domain.PoolCrypto {
			found = true
			l.Gross += s.Gross
			l.Withheld += s.Withheld
			l.Result += s.Result
		}
	}

	if !found {
		return
	}

	for _, s := range sales {
		if poolOf(s) != domain.PoolCrypto || s.Result <= 0 {
			continue
		}

		if l.Gross <= cryptoExemption {
			l.Exempt += s.Result
		} else {
			l.Base += s.Result
		}
	}

	l.Tax = bracketTax(l.Base)
	withheld := l.Withheld + c.withheld[domain.PoolCrypto]
	l.Due = max(l.Tax-withheld, 0)
	c.withheld[domain.PoolCrypto] = max(withheld-l.Tax, 0)

	month.Lines = append(month.Lines, l)
	month.CryptoCarriedIn = c.cryptoDarf

	if total := c.cryptoDarf + l.Due; total < minimumDarf {
		c.cryptoDarf = total
	} else {
		month.CryptoDarf, c.cryptoDarf = total, 0
	}
}

// bracketTax is the tax of a capital gain by the brackets, each rate on its slice.
func bracketTax(gain int64) int64 {
	var tax, floor int64

	for _, b := range cryptoBrackets {
		if gain <= floor {
			break
		}

		tax += percentOf(min(gain, b.upTo)-floor, b.bp)
		floor = b.upTo
	}

	return tax
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
	case s.TaxClass == "crypto":
		return domain.PoolCrypto
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
