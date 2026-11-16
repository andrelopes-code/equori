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
		return time.Time{}, false, nil
	}

	return t.MaturesOn, err == nil, err
}
