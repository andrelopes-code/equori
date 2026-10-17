package marketdata

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordPrices stores ps in one transaction; an existing (instrument, quote, date,
// source) gets the new value (P8 amendment A60).
func (m *Module) RecordPrices(ctx context.Context, ps []Price) error {
	checked := map[money.Currency]Instrument{}
	for _, p := range ps {
		if err := m.validatePrice(ctx, p, checked); err != nil {
			return err
		}
	}
	return m.upsert(ctx, ps)
}

// ImportPrices records a CSV file as source csv, all or nothing.
func (m *Module) ImportPrices(ctx context.Context, content []byte) (int, error) {
	ps, err := domain.ParsePriceCSV(content)
	if err != nil {
		return 0, err
	}
	checked := map[money.Currency]Instrument{}
	for i, p := range ps {
		if err := m.validatePrice(ctx, p, checked); err != nil {
			var fe *domain.FieldError
			if errors.As(err, &fe) {
				return 0, &domain.FieldError{Field: fmt.Sprintf("line %d", i+2), Message: fe.Field + " " + fe.Message}
			}
			return 0, err
		}
	}
	return len(ps), m.upsert(ctx, ps)
}

func (m *Module) validatePrice(ctx context.Context, p Price, checked map[money.Currency]Instrument) error {
	lookup := func(code money.Currency) (Instrument, bool, error) {
		if in, ok := checked[code]; ok {
			return in, true, nil
		}
		in, err := m.Instrument(ctx, string(code))
		if errors.Is(err, ErrUnknownInstrument) {
			return Instrument{}, false, nil
		}
		if err != nil {
			return Instrument{}, false, err
		}
		checked[code] = in
		return in, true, nil
	}
	_, ok, err := lookup(p.Instrument)
	if err != nil {
		return err
	}
	if !ok {
		return &domain.FieldError{Field: "instrument", Message: "is not a known instrument"}
	}
	quote, ok, err := lookup(p.Quote)
	if err != nil {
		return err
	}
	if !ok || quote.Type != domain.TypeCurrency || p.Quote == p.Instrument {
		return &domain.FieldError{Field: "quote_instrument", Message: "must be a currency other than the instrument"}
	}
	if p.Value.Mantissa() <= 0 {
		return &domain.FieldError{Field: "value", Message: "must be positive"}
	}
	return nil
}

func (m *Module) upsert(ctx context.Context, ps []Price) error {
	return pgx.BeginFunc(ctx, m.pool, func(tx pgx.Tx) error {
		q := m.q.WithTx(tx)
		for _, p := range ps {
			priority, err := domain.Priority(p.Source)
			if err != nil {
				return err
			}
			if err := q.UpsertPrice(ctx, postgres.UpsertPriceParams{
				Instrument: string(p.Instrument), QuoteInstrument: string(p.Quote), Date: p.Date,
				Value: toNumeric(p.Value), Source: p.Source, Priority: priority,
			}); err != nil {
				return fmt.Errorf("record price: %w", err)
			}
		}
		return nil
	})
}

// PriceOnOrBefore returns the chosen price of the latest date ≤ date (A60).
func (m *Module) PriceOnOrBefore(ctx context.Context, instrument, quote money.Currency, date time.Time) (Price, bool, error) {
	rows, err := m.q.PriceOnOrBefore(ctx, postgres.PriceOnOrBeforeParams{Instrument: string(instrument), QuoteInstrument: string(quote), Date: date})
	if err != nil || len(rows) == 0 {
		return Price{}, false, err
	}
	p, err := toPrice(rows[0])
	return p, err == nil, err
}

// ListPrices returns the chosen price of each date with prices in [from, to].
func (m *Module) ListPrices(ctx context.Context, instrument, quote money.Currency, from, to time.Time) ([]Price, error) {
	if err := domain.ValidRange(from, to); err != nil {
		return nil, err
	}
	rows, err := m.q.ListChosenPrices(ctx, postgres.ListChosenPricesParams{Instrument: string(instrument), QuoteInstrument: string(quote), FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make([]Price, len(rows))
	for i, r := range rows {
		if out[i], err = toPrice(r); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func toPrice(r postgres.MarketdataPrice) (Price, error) {
	v, err := fromNumeric(r.Value)
	if err != nil {
		return Price{}, err
	}
	return Price{Instrument: money.Currency(r.Instrument), Quote: money.Currency(r.QuoteInstrument), Date: r.Date, Value: v, Source: r.Source}, nil
}

func toNumeric(r money.Rate) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(r.Mantissa()), Exp: -int32(r.Scale()), Valid: true} //nolint:gosec // G115: a rate scale is 0–12
}

// fromNumeric drops trailing zeros: numeric(30,12) stores 5.5 as 5.500000000000.
func fromNumeric(n pgtype.Numeric) (money.Rate, error) {
	if !n.Valid || n.NaN || n.Int == nil {
		return money.Rate{}, fmt.Errorf("read rate: %w", money.ErrInvalidRate)
	}
	m, exp := new(big.Int).Set(n.Int), n.Exp
	ten := big.NewInt(10)
	for ; exp > 0; exp-- {
		m.Mul(m, ten)
	}
	for mod := new(big.Int); exp < 0; exp++ {
		q, r := new(big.Int).QuoRem(m, ten, mod)
		if r.Sign() != 0 {
			break
		}
		m = q
	}
	if !m.IsInt64() {
		return money.Rate{}, fmt.Errorf("read rate %s: %w", m, money.ErrInvalidRate)
	}
	return money.NewRate(m.Int64(), int(-exp))
}
