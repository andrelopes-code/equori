// Package money represents amounts of an instrument as integers scaled by the instrument scale (ADR 005).
package money

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
)

// MaxAmount keeps amounts exact as JSON numbers in JavaScript (2^53 − 1).
const MaxAmount = 1<<53 - 1

var (
	ErrUnknownCurrency   = errors.New("unknown currency")
	ErrCurrencyMismatch  = errors.New("currency mismatch")
	ErrOutOfRange        = errors.New("amount out of range")
	ErrInvalidInstrument = errors.New("invalid instrument")
	ErrDivisionByZero    = errors.New("division by zero")
)

// MaxScale is the largest number of decimals of an instrument (7.4).
const MaxScale = 12

var instrumentCode = regexp.MustCompile(`^[A-Z0-9.]{2,20}$`)

// Currency is the code of an instrument: ISO 4217 for currencies, a ticker or registry code otherwise.
type Currency string

// minorUnits lists the supported currencies and their ISO 4217 exponent.
var minorUnits = map[Currency]int8{
	"ARS": 2, "AUD": 2, "BRL": 2, "CAD": 2, "CHF": 2, "CLP": 0, "CNY": 2, "COP": 2,
	"EUR": 2, "GBP": 2, "JPY": 0, "MXN": 2, "PYG": 0, "USD": 2, "UYU": 2,
}

func ParseCurrency(s string) (Currency, error) {
	c := Currency(s)
	if _, ok := minorUnits[c]; !ok {
		return "", fmt.Errorf("%w: %q", ErrUnknownCurrency, s)
	}
	return c, nil
}

func (c Currency) MinorUnits() int { return int(minorUnits[c]) }

// Currencies returns the supported currencies in ascending code order.
func Currencies() []Currency {
	cs := make([]Currency, 0, len(minorUnits))
	for c := range minorUnits {
		cs = append(cs, c)
	}
	slices.Sort(cs)
	return cs
}

// Money is the quantity of one instrument (chapter 5, 5.1). It is immutable; the zero
// value is invalid. New builds currency amounts, NewOf amounts of any instrument.
type Money struct {
	amount   int64
	currency Currency
	scale    int8
}

func New(amount int64, currency Currency) (Money, error) {
	if _, ok := minorUnits[currency]; !ok {
		return Money{}, fmt.Errorf("%w: %q", ErrUnknownCurrency, currency)
	}
	if amount > MaxAmount || amount < -MaxAmount {
		return Money{}, ErrOutOfRange
	}
	return Money{amount: amount, currency: currency, scale: minorUnits[currency]}, nil
}

// NewOf builds an amount of any instrument; a currency must keep its ISO 4217 scale.
func NewOf(amount int64, code Currency, scale int) (Money, error) {
	if !instrumentCode.MatchString(string(code)) || scale < 0 || scale > MaxScale {
		return Money{}, fmt.Errorf("%w: %q with scale %d", ErrInvalidInstrument, code, scale)
	}
	if units, ok := minorUnits[code]; ok && int(units) != scale {
		return Money{}, fmt.Errorf("%w: %s has scale %d", ErrInvalidInstrument, code, units)
	}
	return Money{amount: amount, currency: code, scale: int8(scale)}.checked()
}

func (m Money) checked() (Money, error) {
	if m.amount > MaxAmount || m.amount < -MaxAmount {
		return Money{}, ErrOutOfRange
	}
	return m, nil
}

func (m Money) Amount() int64      { return m.amount }
func (m Money) Currency() Currency { return m.currency }
func (m Money) IsZero() bool       { return m.amount == 0 }
func (m Money) IsNegative() bool   { return m.amount < 0 }
func (m Money) Scale() int         { return int(m.scale) }

func (m Money) Add(o Money) (Money, error) {
	if m.currency != o.currency {
		return Money{}, fmt.Errorf("%w: %s and %s", ErrCurrencyMismatch, m.currency, o.currency)
	}
	return Money{amount: m.amount + o.amount, currency: m.currency, scale: m.scale}.checked()
}

func (m Money) Sub(o Money) (Money, error) {
	if m.currency != o.currency {
		return Money{}, fmt.Errorf("%w: %s and %s", ErrCurrencyMismatch, m.currency, o.currency)
	}
	return Money{amount: m.amount - o.amount, currency: m.currency, scale: m.scale}.checked()
}

func (m Money) Neg() Money { return Money{amount: -m.amount, currency: m.currency, scale: m.scale} }

// String formats as "BRL -1234.56", for logs and errors only; clients format for display.
func (m Money) String() string { return string(m.currency) + " " + m.Decimal() }

// Decimal formats the amount in the instrument's scale without the code, as "-1234.56".
func (m Money) Decimal() string {
	units := int(m.scale)
	sign, abs := "", m.amount
	if abs < 0 {
		sign, abs = "-", -abs
	}
	digits := strconv.FormatInt(abs, 10)
	if units == 0 {
		return sign + digits
	}
	for len(digits) <= units {
		digits = "0" + digits
	}
	cut := len(digits) - units
	return sign + digits[:cut] + "." + digits[cut:]
}
