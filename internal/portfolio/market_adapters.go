package portfolio

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

// fiscalYearMonths is the span of the periods the facts of a contribution question read.
const fiscalYearMonths = 12

type marketPort struct {
	md       *marketdata.Module
	profiles Profiles
}

func (p marketPort) Scale(ctx context.Context, code money.Currency) (int, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return in.Scale, err
}

func (p marketPort) InstrumentOf(
	ctx context.Context,
	code money.Currency,
) (app.InstrumentInfo, error) {
	in, err := p.md.Instrument(ctx, string(code))
	if errors.Is(err, marketdata.ErrUnknownInstrument) {
		return app.InstrumentInfo{}, fmt.Errorf("%w: %w", app.ErrUnknownInstrument, err)
	}

	return app.InstrumentInfo{
		Type:          in.Type,
		QuoteCurrency: in.QuoteCurrency,
		BooksID:       in.BooksID,
		Subtype:       in.Subtype,
		Issuer:        in.Issuer.Name,
		IssuerScheme:  in.Issuer.Scheme,
		IssuerID:      in.Issuer.ID,
	}, err
}

func (p marketPort) QuoteState(
	ctx context.Context,
	code money.Currency,
) (first, last *time.Time, stale bool, err error) {
	in, err := p.md.Instrument(ctx, string(code))
	if err != nil {
		return nil, nil, false, err
	}

	cov, err := p.md.Coverage(ctx, in)
	if err != nil {
		return nil, nil, false, err
	}

	return cov.First, cov.Last, cov.Stale, nil
}

func (p marketPort) Convert(
	ctx context.Context,
	q money.Money,
	to money.Currency,
	date time.Time,
) (money.Money, []app.Price, error) {
	c, err := p.md.Convert(ctx, q, to, date)

	return conversion(c, err)
}

func (p marketPort) WarmCurrent(ctx context.Context, codes []money.Currency) {
	p.md.WarmCurrent(ctx, codes)
}

func (p marketPort) ConvertCurrent(
	ctx context.Context,
	q money.Money,
	to money.Currency,
) (money.Money, []app.Price, error) {
	c, err := p.md.ConvertCurrent(ctx, q, to)

	return conversion(c, err)
}

// conversion maps the answer of a marketdata conversion to the port types.
func conversion(c marketdata.Conversion, err error) (money.Money, []app.Price, error) {
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return money.Money{}, nil, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	if err != nil {
		return money.Money{}, nil, err
	}

	prices := make([]app.Price, len(c.Prices))
	for i, x := range c.Prices {
		prices[i] = app.Price{
			Instrument: x.Instrument,
			Quote:      x.Quote,
			Date:       x.Date,
			Value:      x.Value,
			Source:     x.Source,
			At:         x.At,
			Open:       x.Open,
		}
	}

	return c.Value, prices, nil
}

func (p marketPort) IndexRates(
	ctx context.Context,
	id string,
	from, to time.Time,
) ([]app.IndexRate, error) {
	return p.rates(ctx, id, dailyPeriod, app.ErrIndexNotDaily, from, to)
}

func (p marketPort) MonthlyRates(
	ctx context.Context,
	id string,
	from, to time.Time,
) ([]app.IndexRate, error) {
	return p.rates(ctx, id, monthlyPeriod, app.ErrIndexNotMonthly, from, to)
}

func (p marketPort) BenchmarkIndex(ctx context.Context, booksID int64) (string, error) {
	l, err := p.profiles.Profile(ctx, booksID)
	if err != nil {
		return "", err
	}

	return defaultBenchmark(l.Region), nil
}

func (p marketPort) YearBasis(index string) int {
	return indexYearBasis(index)
}

func (p marketPort) IndexCurrency(index string) money.Currency {
	return indexCurrency(index)
}

func (p marketPort) ExchangeIndex(from, to money.Currency) string {
	return exchangeIndex(from, to)
}

func (p marketPort) MarketIndexes(ctx context.Context) ([]string, error) {
	indexes, err := p.md.Indexes(ctx)
	if err != nil {
		return nil, err
	}

	var out []string

	for _, x := range indexes {
		if x.Kind == marketdata.IndexKindMarket && x.Period == dailyPeriod {
			out = append(out, x.ID)
		}
	}

	return out, nil
}

func (p marketPort) InflationIndex(ctx context.Context, booksID int64) (string, error) {
	l, err := p.profiles.Profile(ctx, booksID)
	if err != nil {
		return "", err
	}

	return defaultInflation(l.Region), nil
}

// rates returns the rates of an enabled index of the given period in [from, to], parsed to
// fractions; wrongPeriod is the error for an index of another period.
func (p marketPort) rates(
	ctx context.Context,
	id, period string,
	wrongPeriod error,
	from, to time.Time,
) ([]app.IndexRate, error) {
	indexes, err := p.md.Indexes(ctx)
	if err != nil {
		return nil, err
	}

	i := slices.IndexFunc(indexes, func(x marketdata.IndexSummary) bool { return x.ID == id })
	if i < 0 {
		return nil, app.ErrUnknownIndex
	}

	if indexes[i].Period != period {
		return nil, wrongPeriod
	}

	rates, err := p.md.IndexRates(ctx, id, from, to)
	if err != nil {
		return nil, err
	}

	out := make([]app.IndexRate, len(rates))
	for i, r := range rates {
		v, err := strconv.ParseFloat(r.Rate, 64)
		if err != nil {
			return nil, fmt.Errorf(
				"parse the rate of %s on %s: %w",
				id,
				r.Date.Format(time.DateOnly),
				err,
			)
		}

		out[i] = app.IndexRate{Date: r.Date, Rate: v}
	}

	return out, nil
}

func (p marketPort) Coupons(ctx context.Context, code money.Currency) ([]app.Coupon, error) {
	cs, err := p.md.Coupons(ctx, string(code))
	if errors.Is(err, marketdata.ErrNoTerms) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	out := make([]app.Coupon, len(cs))
	for i, c := range cs {
		out[i] = app.Coupon(c)
	}

	return out, nil
}

func (p marketPort) Maturity(ctx context.Context, code money.Currency) (time.Time, bool, error) {
	t, err := p.md.Terms(ctx, string(code))
	if errors.Is(err, marketdata.ErrNoTerms) {
		// A government bond states its maturity in its code: its last payment.
		cs, err := p.md.Coupons(ctx, string(code))
		if errors.Is(err, marketdata.ErrNoTerms) || len(cs) == 0 {
			return time.Time{}, false, nil
		}

		return cs[len(cs)-1].PaysOn, err == nil, err
	}

	return t.MaturesOn, err == nil, err
}

func (p marketPort) ContractFacts(
	ctx context.Context,
	code money.Currency,
) (app.ContractFacts, bool, error) {
	f, err := p.md.ContractFacts(ctx, string(code))
	if errors.Is(err, marketdata.ErrNoTerms) {
		return app.ContractFacts{}, false, nil
	}

	if err != nil {
		return app.ContractFacts{}, false, err
	}

	return app.ContractFacts(f), true, nil
}

func (p marketPort) Adjust(
	ctx context.Context,
	calendar string,
	d time.Time,
	preceding bool,
) (time.Time, error) {
	if preceding {
		return p.md.Adjust(ctx, calendar, d, marketdata.AdjustPreceding)
	}

	return p.md.Adjust(ctx, calendar, d, marketdata.AdjustFollowing)
}
