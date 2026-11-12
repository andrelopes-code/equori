package tool

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Money is an amount for a language model: a decimal string in the instrument's scale,
// so the model never applies a scale itself (ADR 012 T5).
type Money struct {
	Amount   string `json:"amount"   jsonschema:"decimal amount in the instrument's scale, such as -1234.56"`
	Currency string `json:"currency" jsonschema:"currency or instrument code"`
}

func MoneyOf(m money.Money) Money {
	return Money{Amount: m.Decimal(), Currency: string(m.Currency())}
}

// Date is a calendar date written as 2006-01-02.
type Date struct{ time.Time }

const dateLayout = "2006-01-02"

func DateOf(t time.Time) Date { return Date{t} }

// MarshalJSON and UnmarshalJSON override the methods promoted from time.Time.
func (d Date) MarshalJSON() ([]byte, error) { return json.Marshal(d.Format(dateLayout)) }

func (d *Date) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}

	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return err
	}

	d.Time = t

	return nil
}

// OptionalInt is an integer that may be absent: a given 0 differs from no value.
type OptionalInt struct {
	N   int
	Set bool
}

func (o OptionalInt) MarshalJSON() ([]byte, error) { return json.Marshal(o.N) }

func (o *OptionalInt) UnmarshalJSON(b []byte) error {
	if err := json.Unmarshal(b, &o.N); err != nil {
		return err
	}

	o.Set = true

	return nil
}

// OptionalBool is a boolean that may be absent: a given false differs from no value.
type OptionalBool struct {
	B   bool
	Set bool
}

func (o OptionalBool) MarshalJSON() ([]byte, error) { return json.Marshal(o.B) }

func (o *OptionalBool) UnmarshalJSON(b []byte) error {
	if err := json.Unmarshal(b, &o.B); err != nil {
		return err
	}

	o.Set = true

	return nil
}

// ParseAmount reads a decimal string in the code and scale of unit.
func ParseAmount(field, s string, unit money.Money) (money.Money, error) {
	m, err := money.ParseDecimal(s, unit.Currency(), unit.Scale())
	if err != nil {
		return money.Money{}, InvalidArgument(
			field,
			fmt.Sprintf("must be a decimal such as 125.90 with at most %d decimals", unit.Scale()),
		)
	}

	return m, nil
}

// ParsePositive is ParseAmount for a value that must be greater than zero.
func ParsePositive(field, s string, unit money.Money) (money.Money, error) {
	m, err := ParseAmount(field, s, unit)
	if err != nil {
		return money.Money{}, err
	}

	if m.Amount() <= 0 {
		return money.Money{}, InvalidArgument(field, "must be greater than zero")
	}

	return m, nil
}
