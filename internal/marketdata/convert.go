package marketdata

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// pivot is the currency a conversion passes through when no direct or inverse price exists.
const pivot money.Currency = "BRL"

// Conversion is a converted amount and the prices it used (B05).
type Conversion struct {
	Value  money.Money
	Prices []Price
}

// Convert values q in currency to at date by the path of P8 amendment A61: direct
// price, inverse price, or both legs through BRL.
func (m *Module) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (Conversion, error) {
	from := q.Currency()
	if from == to {
		return Conversion{Value: q}, nil
	}
	leg, p, ok, err := m.leg(ctx, from, to, date)
	if err != nil {
		return Conversion{}, err
	}
	legs, prices := []money.Leg{leg}, []Price{p}
	if !ok {
		if from == pivot || to == pivot {
			return Conversion{}, missing(from, to, date)
		}
		first, p1, ok1, err := m.leg(ctx, from, pivot, date)
		if err != nil {
			return Conversion{}, err
		}
		second, p2, ok2, err := m.leg(ctx, pivot, to, date)
		if err != nil {
			return Conversion{}, err
		}
		if !ok1 || !ok2 {
			return Conversion{}, missing(from, to, date)
		}
		legs, prices = []money.Leg{first, second}, []Price{p1, p2}
	}
	v, err := money.Convert(q, to, legs...)
	if err != nil {
		return Conversion{}, fmt.Errorf("convert %s to %s: %w", from, to, err)
	}
	return Conversion{Value: v, Prices: prices}, nil
}

func (m *Module) leg(ctx context.Context, from, to money.Currency, date time.Time) (money.Leg, Price, bool, error) {
	p, ok, err := m.PriceOnOrBefore(ctx, from, to, date)
	if err != nil || ok {
		return money.Leg{Rate: p.Value}, p, ok, err
	}
	p, ok, err = m.PriceOnOrBefore(ctx, to, from, date)
	return money.Leg{Rate: p.Value, Inverse: true}, p, ok, err
}

func missing(from, to money.Currency, date time.Time) error {
	return fmt.Errorf("%w: %s in %s on %s", ErrPriceMissing, from, to, date.Format(time.DateOnly))
}
