// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

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

	return conversion(c, err)
}

func (p pricesAdapter) WarmCurrent(ctx context.Context, codes []money.Currency) {
	p.md.WarmCurrent(ctx, codes)
}

func (p pricesAdapter) ConvertCurrent(
	ctx context.Context,
	q money.Money,
	to money.Currency,
) (app.Conversion, error) {
	c, err := p.md.ConvertCurrent(ctx, q, to)

	return conversion(c, err)
}

// conversion maps the answer of a marketdata conversion to the port types.
func conversion(c marketdata.Conversion, err error) (app.Conversion, error) {
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
			At:         x.At,
			Open:       x.Open,
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

// contracts adapts the contract methods of Market data to the port of the fixed income
// application. A discarded contract leaves the instrument cache.
type contracts struct {
	md  MarketData
	ins *instruments
}

func (c contracts) Check(
	ctx context.Context,
	booksID int64,
	ct app.Contract,
	applicationID uuid.UUID,
) (app.Contract, error) {
	checked, err := c.md.CheckContract(ctx, booksID, toMarketContract(ct), applicationID)
	if fe, ok := errors.AsType[*marketdata.FieldError](err); ok {
		return app.Contract{}, &domain.FieldError{
			Field:   fe.Field,
			Message: fe.Message,
			Err:     app.ErrContractInvalid,
		}
	}

	return fromMarketContract(checked), err
}

func (c contracts) Define(ctx context.Context, booksID int64, ct app.Contract) error {
	return c.md.DefineContract(ctx, booksID, toMarketContract(ct))
}

func (c contracts) Discard(ctx context.Context, booksID int64, code money.Currency) error {
	err := c.md.DiscardContract(ctx, booksID, code)

	c.ins.mu.Lock()
	delete(c.ins.cache, code)
	c.ins.mu.Unlock()

	return err
}

func (c contracts) Price(
	ctx context.Context,
	code, quote money.Currency,
	date time.Time,
) (money.Rate, bool, error) {
	p, ok, err := c.md.PriceOnOrBefore(ctx, code, quote, date)

	return p.Value, ok, err
}

// toMarketContract and fromMarketContract copy the fields of the two Contract types; the
// Payments slices differ in element type.
func toMarketContract(c app.Contract) marketdata.Contract {
	out := marketdata.Contract{
		Code: c.Code, Currency: c.Currency, Subtype: c.Subtype, Name: c.Name,
		IssuerName: c.IssuerName, IssuerScheme: c.IssuerScheme, IssuerID: c.IssuerID,
		IssuedOn: c.IssuedOn, MaturesOn: c.MaturesOn, IndexID: c.IndexID,
		PercentOfIndexBP: c.PercentOfIndexBP, SpreadBP: c.SpreadBP, DayCount: c.DayCount,
		CalendarID: c.CalendarID, DailyLiquidity: c.DailyLiquidity,
		RedeemableFrom: c.RedeemableFrom, Region: c.Region,
		InterestEveryMonths: c.InterestEveryMonths, FirstPaymentOn: c.FirstPaymentOn,
	}

	for _, p := range c.Payments {
		out.Payments = append(out.Payments, marketdata.Payment(p))
	}

	return out
}

func fromMarketContract(c marketdata.Contract) app.Contract {
	out := app.Contract{
		Code: c.Code, Currency: c.Currency, Subtype: c.Subtype, Name: c.Name,
		IssuerName: c.IssuerName, IssuerScheme: c.IssuerScheme, IssuerID: c.IssuerID,
		IssuedOn: c.IssuedOn, MaturesOn: c.MaturesOn, IndexID: c.IndexID,
		PercentOfIndexBP: c.PercentOfIndexBP, SpreadBP: c.SpreadBP, DayCount: c.DayCount,
		CalendarID: c.CalendarID, DailyLiquidity: c.DailyLiquidity,
		RedeemableFrom: c.RedeemableFrom, Region: c.Region,
		InterestEveryMonths: c.InterestEveryMonths, FirstPaymentOn: c.FirstPaymentOn,
	}

	for _, p := range c.Payments {
		out.Payments = append(out.Payments, app.Payment(p))
	}

	return out
}
