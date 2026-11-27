package app

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// rateDecimals is the number of decimals of a stored exchange rate (ADR 005).
const rateDecimals = 12

// cashRate returns the rate that converts the amounts of a trade or an income paid in cash to
// base: nil when cash is the base currency, the rate given, or the stored rate on date (foreign
// cash FC2). A missing rate is a field error on exchange_rate with code price_missing.
func (s *Service) cashRate(
	ctx context.Context,
	cash, base money.Currency,
	date time.Time,
	given *money.Rate,
) (*money.Rate, error) {
	if cash == base {
		if given != nil {
			return nil, fieldErr(
				"exchange_rate",
				"is taken only with cash in another currency",
				domain.ErrValidation,
			)
		}

		return nil, nil
	}

	if given != nil {
		return given, nil
	}

	one, err := money.New(pow10(cash.MinorUnits()).Int64(), cash)
	if err != nil {
		return nil, err
	}

	c, err := s.prices.Convert(ctx, one, base, date)
	if err != nil && !errors.Is(err, ErrPriceMissing) {
		return nil, err
	}

	if rate, ok := pairRate(c, cash, base); err == nil && ok {
		return &rate, nil
	}

	return nil, fieldErr(
		"exchange_rate",
		fmt.Sprintf(
			"has no stored rate of %s in %s on %s; give exchange_rate",
			cash,
			base,
			date.Format(time.DateOnly),
		),
		ErrPriceMissing,
	)
}

// pairRate returns the price of the one pair of c, in units of base for one unit of cash.
func pairRate(c Conversion, cash, base money.Currency) (money.Rate, bool) {
	if len(c.Prices) != 1 {
		return money.Rate{}, false
	}

	p := c.Prices[0]
	switch {
	case p.Instrument == cash && p.Quote == base:
		return p.Value, true
	case p.Instrument == base && p.Quote == cash:
		inverse, err := inverseRate(p.Value)

		return inverse, err == nil
	}

	return money.Rate{}, false
}

// inverseRate returns 1 ÷ r at rateDecimals decimals, half to even.
func inverseRate(r money.Rate) (money.Rate, error) {
	scaled := new(big.Int).Mul(pow10(r.Scale()), pow10(rateDecimals))
	quotient, remainder := new(big.Int).QuoRem(
		scaled,
		big.NewInt(r.Mantissa()),
		new(big.Int),
	)

	// Half to even: compare twice the remainder with the divisor.
	switch twice := remainder.Lsh(remainder, 1).Cmp(big.NewInt(r.Mantissa())); {
	case twice > 0, twice == 0 && quotient.Bit(0) == 1:
		quotient.Add(quotient, big.NewInt(1))
	}

	if !quotient.IsInt64() {
		return money.Rate{}, fmt.Errorf("inverse of %s: %w", r, money.ErrInvalidRate)
	}

	return money.NewRate(quotient.Int64(), rateDecimals)
}

func cashCurrencyMessage(base, quote money.Currency) string {
	if quote == "" || quote == base {
		return "must be in the base currency " + string(base)
	}

	return "must be in the base currency " + string(base) + " or in " + string(quote)
}
