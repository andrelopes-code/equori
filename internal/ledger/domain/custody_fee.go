package domain

import (
	"math/big"
	"time"
)

// CustodyRule is the custody fee a region charges on a security: RateBP a year, pro rata by
// calendar days, on the value sold above ExemptMinor, for a sale on or after From; PaidTo is the
// last day the fee was already paid to before a date (a coupon, an earlier charge).
type CustodyRule struct {
	RateBP      int
	ExemptMinor int64
	From        time.Time
	PaidTo      func(date time.Time) time.Time
}

// Applies reports whether r estimates the fee of a sale on date.
func (r CustodyRule) Applies(date time.Time) bool { return r.RateBP > 0 && !date.Before(r.From) }

// CustodyFee is the custody fee a sale on date of the consumed lots for proceeds pays under r:
// each lot's share of the proceeds above the exemption, times RateBP, times the days since the
// later of its purchase and r.PaidTo, over 365, rounded half to even (coverage row T-09).
func CustodyFee(r CustodyRule, consumed []Lot, proceeds int64, date time.Time) int64 {
	var units int64
	for _, l := range consumed {
		units += l.Quantity
	}

	charged := proceeds - r.ExemptMinor
	if units <= 0 || charged <= 0 || r.RateBP <= 0 {
		return 0
	}

	var paidTo time.Time
	if r.PaidTo != nil {
		paidTo = r.PaidTo(date)
	}

	// Σ charged × quantity/units × rate/10000 × days/365, kept exact until the end.
	sum := new(big.Int)

	for _, l := range consumed {
		from := l.AcquiredOn
		if paidTo.After(from) {
			from = paidTo
		}

		days := int64(date.Sub(from).Hours() / 24)
		if days > 0 {
			sum.Add(sum, new(big.Int).Mul(big.NewInt(l.Quantity), big.NewInt(days)))
		}
	}

	num := new(big.Int).Mul(sum, big.NewInt(charged*int64(r.RateBP)))
	den := new(big.Int).Mul(big.NewInt(units), big.NewInt(10000*365))

	return halfEven(num, den)
}

// halfEven is num ÷ den rounded to the nearest integer, a tie to the even one; den is positive.
func halfEven(num, den *big.Int) int64 {
	q, m := new(big.Int).DivMod(num, den, new(big.Int))
	if c := new(big.Int).Lsh(m, 1).Cmp(den); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(1))
	}

	return q.Int64()
}
