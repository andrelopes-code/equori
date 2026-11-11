package marketdata

import (
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const probeDays = 10

// ProbeQuote asks every enabled source that would quote in for its latest quote of the last 10
// days, and names the disabled sources that would quote it. Nothing is stored (A222 MQ27).
func (m *Module) ProbeQuote(ctx context.Context, in Instrument) (domain.ProbeResult, error) {
	if !slices.Contains(domain.SecurityTypes, in.Type) {
		return domain.ProbeResult{}, &domain.FieldError{Field: "type", Message: "must be a security type"}
	}

	if err := m.checkSymbolSources(in.Symbols); err != nil {
		return domain.ProbeResult{}, err
	}

	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && quote.Type != domain.TypeCurrency) {
		return domain.ProbeResult{}, &domain.FieldError{Field: "quote_currency", Message: "must be a currency"}
	}

	if err != nil {
		return domain.ProbeResult{}, err
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return domain.ProbeResult{}, err
	}

	out := domain.ProbeResult{Quotes: []domain.ProbeQuote{}, Available: []string{}}

	var (
		wg      sync.WaitGroup
		sources []feed.Source
	)

	for _, src := range m.feeds.Sources {
		switch {
		case len(src.Codes(feedInstruments([]Instrument{in}))) == 0:
		case !on[src.ID()]:
			out.Available = append(out.Available, src.ID())
		default:
			sources = append(sources, src)
		}
	}

	out.Quotes = make([]domain.ProbeQuote, len(sources))
	to := m.feeds.Clock.Today(ctx)

	for i, src := range sources {
		wg.Go(func() {
			ctx, cancel := context.WithTimeout(ctx, m.feeds.ProbeBound)
			defer cancel()

			quotes, err := src.Fetch(ctx, []money.Currency{in.Code}, to.AddDate(0, 0, -probeDays), to)

			out.Quotes[i] = latestQuote(src.ID(), in.Code, quotes, err)
		})
	}

	wg.Wait()

	return out, nil
}

// latestQuote keeps the quote of code with the latest date, also when Fetch failed after it read
// some quotes (a source returns the quotes read before a failure).
func latestQuote(source string, code money.Currency, quotes []feed.Quote, err error) domain.ProbeQuote {
	out := domain.ProbeQuote{Source: source}

	for _, q := range quotes {
		if q.Instrument == code && (out.Date == nil || q.Date.After(*out.Date)) {
			out.Date, out.Value = &q.Date, q.Value
		}
	}

	if out.Date == nil && err != nil {
		out.Error = err.Error()
	}

	return out
}
