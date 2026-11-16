package marketdata

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

// Coupon is what one unit of a fixed income security pays on a payment date (A236 FC8).
type Coupon = domain.Coupon

// Coupons is the coupon of each payment of code, in date order; ErrNoTerms when code has none.
func (m *Module) Coupons(ctx context.Context, code string) ([]Coupon, error) {
	row, err := m.q.GetTerms(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoTerms
	}

	if err != nil {
		return nil, err
	}

	in, err := m.Instrument(ctx, code)
	if err != nil {
		return nil, err
	}

	inputs, err := m.accrualInputs(ctx, row, in, row.MaturesOn)
	if err != nil {
		return nil, err
	}

	return domain.Coupons(
		inputs.terms,
		m.businessDays,
		inputs.quoteScale,
		inputs.rates,
		inputs.isBusinessDay,
	)
}
