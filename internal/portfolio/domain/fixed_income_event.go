package domain

import (
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
)

// RecordWindowDays is how far from the date of an event an income or a sale records it (A236
// FC18).
const RecordWindowDays = 7

// Event kinds of a fixed income security (A236 FC17).
const (
	EventInterest     = "interest"
	EventAmortization = "amortization"
	EventMaturity     = "maturity"
)

// Event states (A236 FC18).
const (
	StateUpcoming = "upcoming"
	StateDue      = "due"
	StateRecorded = "recorded"
)

// AmortizedUnits is quantity × bp ÷ residualBP, half to even, in the minor units of quantity; the
// residual is the basis points of the principal left before the payment.
func AmortizedUnits(quantity int64, bp, residualBP int) int64 {
	if residualBP <= 0 || bp <= 0 {
		return 0
	}

	if bp >= residualBP {
		return quantity
	}

	num := new(big.Int).Mul(big.NewInt(quantity), big.NewInt(int64(bp)))

	return divHalfEven(num, big.NewInt(int64(residualBP)))
}

// GrossOf is perUnit × quantity in the minor units of the quote currency, half to even. perUnit
// is a decimal string and quantity is in minor units of the instrument at quantityScale.
func GrossOf(perUnit string, quantity int64, quantityScale, quoteScale int) (int64, error) {
	r, ok := new(big.Rat).SetString(perUnit)
	if !ok {
		return 0, fmt.Errorf("parse the amount per unit %q", perUnit)
	}

	r.Mul(r, big.NewRat(quantity, 1))
	r.Mul(r, new(big.Rat).SetFrac(pow10(quoteScale), pow10(quantityScale)))

	return divHalfEven(r.Num(), r.Denom()), nil
}

// EventRecorded tells whether the account recorded the event: an income of type coupon or
// interest within RecordWindowDays of date for an interest, a sale of at least units within the
// same window for an amortization or a maturity.
func EventRecorded(
	kind string,
	account uuid.UUID,
	date time.Time,
	units int64,
	incomes []IncomeEvent,
	sales []RealizedResult,
) bool {
	if kind == EventInterest {
		for _, i := range incomes {
			if i.AccountID == account && (i.Type == "coupon" || i.Type == "interest") &&
				withinWindow(i.Date, date) {
				return true
			}
		}

		return false
	}

	for _, s := range sales {
		if s.AccountID == account && s.Quantity >= units && withinWindow(s.Date, date) {
			return true
		}
	}

	return false
}

// EventState is recorded when recorded, else due on or before today, else upcoming.
func EventState(date, today time.Time, recorded bool) string {
	switch {
	case recorded:
		return StateRecorded
	case !date.After(today):
		return StateDue
	}

	return StateUpcoming
}

func withinWindow(a, b time.Time) bool {
	days := a.Sub(b).Hours() / 24

	return days >= -RecordWindowDays && days <= RecordWindowDays
}

func pow10(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }

// divHalfEven is num ÷ den rounded to the nearest integer, a tie to the even one; den is positive.
func divHalfEven(num, den *big.Int) int64 {
	q, m := new(big.Int).DivMod(num, den, new(big.Int))
	twice := new(big.Int).Lsh(m, 1)

	if c := twice.Cmp(den); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(1))
	}

	return q.Int64()
}
