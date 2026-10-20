package tool

import (
	"encoding/json"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Money is an amount for a language model: a decimal string in the instrument's scale,
// so the model never applies a scale itself (ADR 012 T5).
type Money struct {
	Amount   string `json:"amount" jsonschema:"decimal amount in the instrument's scale, such as -1234.56"`
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
