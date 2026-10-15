// Package money represents amounts as integer minor units with an ISO 4217 currency (ADR 005).
package money

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
)

// MaxAmount keeps amounts exact as JSON numbers in JavaScript (2^53 − 1).
const MaxAmount = 1<<53 - 1

var (
	ErrUnknownCurrency  = errors.New("unknown currency")
	ErrCurrencyMismatch = errors.New("currency mismatch")
	ErrOutOfRange       = errors.New("amount out of range")
)

type Currency string

// minorUnits lists the supported currencies and their ISO 4217 exponent.
var minorUnits = map[Currency]int{
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

func (c Currency) MinorUnits() int { return minorUnits[c] }

// Currencies returns the supported currencies in ascending code order.
func Currencies() []Currency {
	cs := make([]Currency, 0, len(minorUnits))
	for c := range minorUnits {
		cs = append(cs, c)
	}
	slices.Sort(cs)
	return cs
}

// Money is immutable. The zero value is invalid; build values with New.
type Money struct {
	amount   int64
	currency Currency
}

func New(amount int64, currency Currency) (Money, error) {
	if _, ok := minorUnits[currency]; !ok {
		return Money{}, fmt.Errorf("%w: %q", ErrUnknownCurrency, currency)
	}
	if amount > MaxAmount || amount < -MaxAmount {
		return Money{}, ErrOutOfRange
	}
	return Money{amount: amount, currency: currency}, nil
}

func (m Money) Amount() int64      { return m.amount }
func (m Money) Currency() Currency { return m.currency }
func (m Money) IsZero() bool       { return m.amount == 0 }
func (m Money) IsNegative() bool   { return m.amount < 0 }

func (m Money) Add(o Money) (Money, error) {
	if m.currency != o.currency {
		return Money{}, fmt.Errorf("%w: %s and %s", ErrCurrencyMismatch, m.currency, o.currency)
	}
	return New(m.amount+o.amount, m.currency)
}

func (m Money) Sub(o Money) (Money, error) {
	if m.currency != o.currency {
		return Money{}, fmt.Errorf("%w: %s and %s", ErrCurrencyMismatch, m.currency, o.currency)
	}
	return New(m.amount-o.amount, m.currency)
}

func (m Money) Neg() Money { return Money{amount: -m.amount, currency: m.currency} }

// String formats as "BRL -1234.56", for logs and errors only; clients format for display.
func (m Money) String() string {
	units := m.currency.MinorUnits()
	sign, abs := "", m.amount
	if abs < 0 {
		sign, abs = "-", -abs
	}
	digits := strconv.FormatInt(abs, 10)
	if units == 0 {
		return fmt.Sprintf("%s %s%s", m.currency, sign, digits)
	}
	for len(digits) <= units {
		digits = "0" + digits
	}
	cut := len(digits) - units
	return fmt.Sprintf("%s %s%s.%s", m.currency, sign, digits[:cut], digits[cut:])
}
