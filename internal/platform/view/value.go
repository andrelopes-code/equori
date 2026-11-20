package view

import (
	"errors"
	"fmt"
	"math/big"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ErrCurrencies: a figure would add or compare amounts of different currencies (C2).
var ErrCurrencies = errors.New("the amounts are in different currencies")

// Amount parses the decimal amount of a tool output into minor units of its currency.
func Amount(decimal, currency string) (Money, error) {
	code, err := money.ParseCurrency(currency)
	if err != nil {
		return Money{}, err
	}

	m, err := money.ParseDecimal(decimal, code, code.MinorUnits())
	if err != nil {
		return Money{}, fmt.Errorf("parse amount %q: %w", decimal, err)
	}

	return Money{Amount: m.Amount(), Currency: currency}, nil
}

// Share is part over total in basis points, rounded half to even; 0 when total is 0.
func Share(part, total int64) int64 {
	if total == 0 {
		return 0
	}

	r := new(big.Rat).SetFrac(big.NewInt(part*10000), big.NewInt(total))
	q, rem := new(big.Int).QuoRem(r.Num(), r.Denom(), new(big.Int))
	twice := new(big.Int).Mul(new(big.Int).Abs(rem), big.NewInt(2))

	switch c := twice.Cmp(r.Denom()); {
	case c > 0, c == 0 && q.Bit(0) == 1:
		if rem.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}

	return q.Int64()
}

// MoneyValue, BPValue, CountValue, TextValue and DateValue wrap one figure as a Value.
func MoneyValue(m Money) Value { return Value{Money: &m} }
func BPValue(bp int64) Value   { return Value{BP: &bp} }
func CountValue(n int64) Value { return Value{Count: &n} }
func TextValue(s string) Value { return Value{Text: s} }
func DateValue(d string) Value { return Value{Date: d} }

func MonthValue(m string) Value { return Value{Month: m} }

func TimesValue(bp int64) Value { return Value{Times: &bp} }

func RateValue(bp int64) Value { return Value{Rate: &bp} }

func PointsValue(bp int64) Value { return Value{Points: &bp} }
