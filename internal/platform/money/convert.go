package money

import (
	"fmt"
	"math/big"
)

// Leg is one rate of a conversion; Inverse divides by the rate instead of multiplying.
type Leg struct {
	Rate    Rate
	Inverse bool
}

// Convert multiplies m by every leg exactly and rounds half to even once, to the scale
// of the currency to (chapter 5, 5.1).
func Convert(m Money, to Currency, legs ...Leg) (Money, error) {
	units, ok := minorUnits[to]
	if !ok {
		return Money{}, fmt.Errorf("%w: %q", ErrUnknownCurrency, to)
	}
	if len(legs) == 0 && m.currency != to {
		return Money{}, fmt.Errorf("%w: %s to %s without a rate", ErrCurrencyMismatch, m.currency, to)
	}
	v := new(big.Rat).SetFrac(big.NewInt(m.amount), pow10(int(m.scale)))
	for _, l := range legs {
		r := new(big.Rat).SetFrac(big.NewInt(l.Rate.mantissa), pow10(int(l.Rate.scale)))
		if l.Inverse {
			r.Inv(r)
		}
		v.Mul(v, r)
	}
	v.Mul(v, new(big.Rat).SetInt(pow10(int(units))))
	amount, err := roundHalfEven(v)
	if err != nil {
		return Money{}, err
	}
	return New(amount, to)
}

// Fraction returns m × num ÷ den rounded half to even, in the instrument of m.
func Fraction(m Money, num, den int64) (Money, error) {
	if den == 0 {
		return Money{}, ErrDivisionByZero
	}
	amount, err := roundHalfEven(new(big.Rat).SetFrac(new(big.Int).Mul(big.NewInt(m.amount), big.NewInt(num)), big.NewInt(den)))
	if err != nil {
		return Money{}, err
	}
	return Money{amount: amount, currency: m.currency, scale: m.scale}.checked()
}

// Quotient returns a ÷ b per whole unit of each instrument, rounded half to even to
// decimals places (average cost: cost basis ÷ quantity).
func Quotient(a, b Money, decimals int) (Rate, error) {
	if b.amount == 0 {
		return Rate{}, ErrDivisionByZero
	}
	v := new(big.Rat).SetFrac(new(big.Int).Mul(big.NewInt(a.amount), pow10(int(b.scale))), new(big.Int).Mul(big.NewInt(b.amount), pow10(int(a.scale))))
	v.Mul(v, new(big.Rat).SetInt(pow10(decimals)))
	mantissa, err := roundHalfEven(v)
	if err != nil {
		return Rate{}, err
	}
	return NewRate(mantissa, decimals)
}

func pow10(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }

func roundHalfEven(v *big.Rat) (int64, error) {
	q, r := new(big.Int).QuoRem(v.Num(), v.Denom(), new(big.Int))
	twice := new(big.Int).Abs(r)
	twice.Lsh(twice, 1)
	if c := twice.Cmp(v.Denom()); c > 0 || (c == 0 && q.Bit(0) == 1) {
		if v.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}
	if !q.IsInt64() || q.Int64() > MaxAmount || q.Int64() < -MaxAmount {
		return 0, ErrOutOfRange
	}
	return q.Int64(), nil
}
