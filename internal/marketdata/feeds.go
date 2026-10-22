package marketdata

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// feedWindowDays bounds how far back a feed fetches (P8 amendment A62).
const feedWindowDays = 30

// FeedConfig lists the price sources TickFeeds runs.
type FeedConfig struct {
	Sources []feed.Source
	Client  *http.Client
	Clock   clock.Clock
	Log     *slog.Logger
}

// WithFeeds sets the feeds TickFeeds runs; the composition root calls it once.
func (m *Module) WithFeeds(cfg FeedConfig) *Module {
	m.feeds = cfg
	return m
}

// RunFeeds ticks now and then every interval until ctx ends.
func (m *Module) RunFeeds(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		m.TickFeeds(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// TickFeeds fetches each source from the day after its latest price (per code), never
// earlier than today − 30 days, to today. Consecutive codes with the same start share one
// fetch. A failure is logged; the next tick fetches the same days again.
func (m *Module) TickFeeds(ctx context.Context) {
	for _, src := range m.feeds.Sources {
		m.tick(ctx, src)
	}
}

func (m *Module) tick(ctx context.Context, src feed.Source) {
	list, err := m.ListInstruments(ctx, "")
	if err != nil {
		m.logFeed(ctx, err, "source", src.ID())
		return
	}
	ins := make([]feed.Instrument, len(list))
	for i, in := range list {
		ins[i] = feed.Instrument{Code: in.Code, Type: in.Type, Exchange: in.Exchange, QuoteCurrency: in.QuoteCurrency}
	}
	codes := src.Codes(ins)
	if len(codes) == 0 {
		return
	}
	today := m.feeds.Clock.Today()
	starts := make([]time.Time, len(codes))
	for i, code := range codes {
		starts[i], err = m.feedStart(ctx, src.ID(), code, today)
		if err != nil {
			m.logFeed(ctx, err, "source", src.ID(), "instrument", code)
			return
		}
	}
	for i := 0; i < len(codes); {
		j := i + 1
		for j < len(codes) && starts[j].Equal(starts[i]) {
			j++
		}
		if !starts[i].After(today) {
			quotes, err := src.Fetch(ctx, codes[i:j], starts[i], today)
			if storeErr := m.storeQuotes(ctx, src.ID(), quotes); err == nil {
				err = storeErr
			}
			m.logFetchError(ctx, src.ID(), err)
		}
		i = j
	}
}

func (m *Module) logFetchError(ctx context.Context, source string, err error) {
	if err == nil {
		return
	}
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		for _, e := range joined.Unwrap() {
			m.logFetchError(ctx, source, e)
		}
		return
	}
	var scope *feed.ScopeError
	if errors.As(err, &scope) {
		m.logFeed(ctx, err, "source", source, scope.Key, scope.Value)
		return
	}
	m.logFeed(ctx, err, "source", source)
}

// feedStart is the first day to fetch for source, by instrument when one is given.
func (m *Module) feedStart(ctx context.Context, source string, instrument money.Currency, today time.Time) (time.Time, error) {
	var code *string
	if instrument != "" {
		s := string(instrument)
		code = &s
	}
	latest, err := m.q.LatestSourceDate(ctx, postgres.LatestSourceDateParams{Source: source, Instrument: code})
	if err != nil {
		return time.Time{}, err
	}
	earliest := today.AddDate(0, 0, -feedWindowDays)
	return slices.MaxFunc([]time.Time{latest.AddDate(0, 0, 1), earliest}, time.Time.Compare), nil
}

func (m *Module) storeQuotes(ctx context.Context, source string, quotes []feed.Quote) error {
	ps := make([]Price, len(quotes))
	for i, q := range quotes {
		ps[i] = Price{Instrument: q.Instrument, Quote: q.Quote, Date: q.Date, Value: q.Value, Source: source}
	}
	return m.upsert(ctx, ps)
}

func (m *Module) logFeed(ctx context.Context, err error, attrs ...any) {
	m.feeds.Log.ErrorContext(ctx, "price feed", append(attrs, "error", err)...)
}
