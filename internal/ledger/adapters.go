// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type regionDefaults struct{}

func (regionDefaults) ForeignChargeBP(region string) int { return DefaultForeignChargeBP(region) }

func (regionDefaults) WithholdingBP(region, incomeType string, date time.Time) int {
	return DefaultWithholdingBP(region, incomeType, date)
}

func (regionDefaults) ReserveYieldPercent(currency money.Currency) int64 {
	return DefaultReserveYieldPercent(currency)
}

func (regionDefaults) FixedIncomeWithholding(
	region, instrumentType, subtype string,
) (domain.WithholdingTable, bool) {
	return FixedIncomeWithholding(region, instrumentType, subtype)
}

func (regionDefaults) SeparatesDayTrades(region string) bool { return SeparatesDayTrades(region) }

func (regionDefaults) CostMethod(region, instrumentType string) string {
	return CostMethod(region, instrumentType)
}

type pricesAdapter struct{ md MarketData }

func (p pricesAdapter) Convert(
	ctx context.Context,
	q money.Money,
	to money.Currency,
	date time.Time,
) (app.Conversion, error) {
	c, err := p.md.Convert(ctx, q, to, date)
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return app.Conversion{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	if err != nil {
		return app.Conversion{}, err
	}

	out := app.Conversion{Value: c.Value, Prices: make([]app.Price, len(c.Prices))}
	for i, x := range c.Prices {
		out.Prices[i] = app.Price{
			Instrument: x.Instrument,
			Quote:      x.Quote,
			Date:       x.Date,
			Value:      x.Value,
			Source:     x.Source,
		}
	}

	return out, nil
}

type calendarAdapter struct{ cal MarketData }

func (c calendarAdapter) Adjust(
	ctx context.Context,
	name string,
	d time.Time,
	adjustment string,
) (time.Time, error) {
	return c.cal.Adjust(ctx, name, d, marketdata.Adjustment(adjustment))
}

func (c calendarAdapter) DefaultCalendar(
	region string,
) string {
	return c.cal.DefaultCalendar(region)
}

// instruments caches Market data instruments for the module's lifetime: code, type,
// scale and quote currency are immutable (P8 amendment A59).
type instruments struct {
	md    MarketData
	mu    sync.Mutex
	cache map[money.Currency]app.Instrument
}

func (c *instruments) Instrument(ctx context.Context, code money.Currency) (app.Instrument, error) {
	c.mu.Lock()
	in, ok := c.cache[code]
	c.mu.Unlock()

	if ok {
		return in, nil
	}

	m, err := c.md.Instrument(ctx, string(code))
	if errors.Is(err, marketdata.ErrUnknownInstrument) {
		return app.Instrument{}, app.ErrUnknownInstrument
	}

	if err != nil {
		return app.Instrument{}, err
	}

	in = app.Instrument{
		Code:          m.Code,
		Scale:         m.Scale,
		QuoteCurrency: m.QuoteCurrency,
		Type:          m.Type,
		BooksID:       m.BooksID,
	}

	c.mu.Lock()
	c.cache[code] = in
	c.mu.Unlock()

	return in, nil
}

// Subtype is not cached: an owner can retype it.
func (c *instruments) Subtype(ctx context.Context, code money.Currency) (string, error) {
	m, err := c.md.Instrument(ctx, string(code))
	if errors.Is(err, marketdata.ErrUnknownInstrument) {
		return "", app.ErrUnknownInstrument
	}

	return m.Subtype, err
}

// ResolveCode is not cached: it depends on the instruments defined at call time.
func (c *instruments) ResolveCode(
	ctx context.Context,
	code money.Currency,
) (money.Currency, error) {
	resolved, err := c.md.ResolveCode(ctx, string(code))
	if err != nil {
		return "", err
	}

	return money.Currency(resolved), nil
}

// SettlementDate is not cached: it depends on the calendars stored at call time.
func (c *instruments) SettlementDate(
	ctx context.Context,
	code money.Currency,
	date time.Time,
) (time.Time, error) {
	return c.md.SettlementDate(ctx, string(code), date)
}
