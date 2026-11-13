package marketdata

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

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
	// posTrend is the position of the first date of the trend; the others follow it.
	posTrend
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

// quotePrices reads the last price of each pair, then the price on each reference date counted
// back from the date of that last price (IQ4).
func (m *Module) quotePrices(
	ctx context.Context,
	instruments, quotes []string,
) (map[quotePair]map[int32]*domain.QuotePoint, error) {
	today := m.feeds.Clock.Today(ctx)

	lasts, err := m.q.ListQuotePrices(ctx, postgres.ListQuotePricesParams{
		Instruments: instruments,
		Quotes:      quotes,
		Dates:       []time.Time{today},
	})
	if err != nil {
		return nil, fmt.Errorf("list last prices: %w", err)
	}

	out := make(map[quotePair]map[int32]*domain.QuotePoint)
	ask := postgres.ListQuoteReferencesParams{}

	for _, r := range lasts {
		if err := addQuotePoint(
			out,
			r.Instrument,
			r.QuoteInstrument,
			r.Position,
			r.Date,
			r.Value,
		); err != nil {
			return nil, err
		}

		ask = withReferences(ask, r.Instrument, r.QuoteInstrument, r.Date, today)
	}

	refs, err := m.q.ListQuoteReferences(ctx, ask)
	if err != nil {
		return nil, fmt.Errorf("list reference prices: %w", err)
	}

	for _, r := range refs {
		if err := addQuotePoint(
			out,
			r.Instrument,
			r.QuoteInstrument,
			r.Position,
			r.Date,
			r.Value,
		); err != nil {
			return nil, err
		}
	}

	return out, nil
}

// withReferences appends the reference dates and the trend dates of one pair to ask. The year to date is asked only
// when the last price lies in the year of today: a price of an earlier year gives none.
func withReferences(
	ask postgres.ListQuoteReferencesParams,
	instrument, quote string,
	last, today time.Time,
) postgres.ListQuoteReferencesParams {
	refs := domain.QuoteReferences(last)
	days := map[int32]time.Time{
		posWeek:    refs.Week,
		posMonth:   refs.Month,
		posQuarter: refs.Quarter,
		posYear:    refs.Year,
	}

	if last.Year() == today.Year() {
		days[posYearToDate] = refs.YearToDate
	}

	for k, day := range domain.QuoteTrendDays(last) {
		days[posTrend+int32(k)] = day
	}

	for position, day := range days {
		ask.Instruments = append(ask.Instruments, instrument)
		ask.Quotes = append(ask.Quotes, quote)
		ask.Positions = append(ask.Positions, position)
		ask.Days = append(ask.Days, day)
	}

	return ask
}

func addQuotePoint(
	out map[quotePair]map[int32]*domain.QuotePoint,
	instrument, quote string,
	position int32,
	date time.Time,
	number pgtype.Numeric,
) error {
	value, err := platformpg.RateOf(number)
	if err != nil {
		return fmt.Errorf("read the price of %s: %w", instrument, err)
	}

	pair := quotePair{money.Currency(instrument), money.Currency(quote)}
	if out[pair] == nil {
		out[pair] = make(map[int32]*domain.QuotePoint)
	}

	out[pair][position] = &domain.QuotePoint{Date: date, Value: value}

	return nil
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

	if q.Last != nil {
		q.Trend = make([]*domain.QuotePoint, domain.TrendSamples)
		for k := range q.Trend {
			q.Trend[k] = at[posTrend+int32(k)]
		}
	}

	return q
}
