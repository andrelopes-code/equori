package marketdata

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

// positions of the dates sent to ListQuotePrices, counted from 1.
const (
	posLast = iota + 1
	posWeek
	posMonth
	posQuarter
	posYear
	posYearToDate
)

// ListInstrumentQuotes returns, for each instrument with a quote instrument, its last price and the
// prices its changes start from, in code order (IQ1 to IQ5). A currency is quoted in base.
func (m *Module) ListInstrumentQuotes(
	ctx context.Context,
	base money.Currency,
) ([]domain.InstrumentQuote, error) {
	if _, err := money.ParseCurrency(string(base)); err != nil {
		return nil, &domain.FieldError{Field: "base", Message: "must be a known currency"}
	}

	rows, err := m.q.ListInstruments(ctx)
	if err != nil {
		return nil, fmt.Errorf("list instruments: %w", err)
	}

	out := make([]domain.InstrumentQuote, 0, len(rows))
	instruments := make([]string, 0, len(rows))
	quotes := make([]string, 0, len(rows))

	for _, r := range rows {
		quote := base
		if r.QuoteCurrency != nil {
			quote = money.Currency(*r.QuoteCurrency)
		}

		if quote == money.Currency(r.Code) {
			continue
		}

		out = append(out, domain.InstrumentQuote{Instrument: money.Currency(r.Code), Quote: quote})
		instruments = append(instruments, r.Code)
		quotes = append(quotes, string(quote))
	}

	prices, err := m.quotePrices(ctx, instruments, quotes)
	if err != nil {
		return nil, err
	}

	for i := range out {
		out[i] = withPrices(out[i], prices[quotePair{out[i].Instrument, out[i].Quote}])
	}

	return out, nil
}

// quotePair keys the prices of one instrument against one quote instrument.
type quotePair struct{ instrument, quote money.Currency }

func (m *Module) quotePrices(
	ctx context.Context,
	instruments, quotes []string,
) (map[quotePair]map[int32]*domain.QuotePoint, error) {
	today := m.feeds.Clock.Today(ctx)
	refs := domain.QuoteReferences(today)

	rows, err := m.q.ListQuotePrices(ctx, postgres.ListQuotePricesParams{
		Instruments: instruments,
		Quotes:      quotes,
		Dates: []time.Time{
			today,
			refs.Week,
			refs.Month,
			refs.Quarter,
			refs.Year,
			refs.YearToDate,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("list quote prices: %w", err)
	}

	out := make(map[quotePair]map[int32]*domain.QuotePoint)

	for _, r := range rows {
		value, err := platformpg.RateOf(r.Value)
		if err != nil {
			return nil, fmt.Errorf("read the price of %s: %w", r.Instrument, err)
		}

		pair := quotePair{money.Currency(r.Instrument), money.Currency(r.QuoteInstrument)}
		if out[pair] == nil {
			out[pair] = make(map[int32]*domain.QuotePoint)
		}

		out[pair][r.Position] = &domain.QuotePoint{Date: r.Date, Value: value}
	}

	return out, nil
}

// withPrices sets the last price and the references of q; a reference that does not predate the
// last price stays nil (IQ5).
func withPrices(q domain.InstrumentQuote, at map[int32]*domain.QuotePoint) domain.InstrumentQuote {
	q.Last = at[posLast]
	q.References = domain.QuoteReferencesOf{
		Week:       domain.Inside(q.Last, at[posWeek]),
		Month:      domain.Inside(q.Last, at[posMonth]),
		Quarter:    domain.Inside(q.Last, at[posQuarter]),
		Year:       domain.Inside(q.Last, at[posYear]),
		YearToDate: domain.Inside(q.Last, at[posYearToDate]),
	}

	return q
}
