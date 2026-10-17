package marketdata

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// feedWindowDays bounds how far back a feed fetches (P8 amendment A62).
const feedWindowDays = 30

// FeedConfig enables the price feeds; their requests go only to the given base URLs (N17).
type FeedConfig struct {
	PTAX, COTAHIST       bool
	PTAXURL, COTAHISTURL string
	Client               *http.Client
	Clock                clock.Clock
	Log                  *slog.Logger
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

// TickFeeds fetches each enabled feed from the day after its latest price, never
// earlier than today − 30 days, to today. A failure ends that feed's run and is logged;
// the next tick fetches the same days again.
func (m *Module) TickFeeds(ctx context.Context) {
	if m.feeds.PTAX {
		m.tickPTAX(ctx)
	}
	if m.feeds.COTAHIST {
		m.tickCOTAHIST(ctx)
	}
}

func (m *Module) tickPTAX(ctx context.Context) {
	src := feed.NewPTAX(m.feeds.Client, m.feeds.PTAXURL)
	currencies, err := m.ListInstruments(ctx, domain.TypeCurrency)
	if err != nil {
		m.logFeed(ctx, err, "source", domain.SourceBCBPTAX)
		return
	}
	today := m.feeds.Clock.Today()
	for _, c := range currencies {
		if c.Code == pivot {
			continue
		}
		from, err := m.feedStart(ctx, domain.SourceBCBPTAX, c.Code, today)
		if err != nil {
			m.logFeed(ctx, err, "source", domain.SourceBCBPTAX, "instrument", c.Code)
			return
		}
		if from.After(today) {
			continue
		}
		quotes, err := src.Fetch(ctx, c.Code, from, today)
		if err == nil {
			err = m.storeQuotes(ctx, domain.SourceBCBPTAX, quotes)
		}
		if err != nil {
			m.logFeed(ctx, err, "source", domain.SourceBCBPTAX, "instrument", c.Code)
			return
		}
	}
}

func (m *Module) tickCOTAHIST(ctx context.Context) {
	src := feed.NewCOTAHIST(m.feeds.Client, m.feeds.COTAHISTURL)
	ins, err := m.ListInstruments(ctx, "")
	if err != nil {
		m.logFeed(ctx, err, "source", domain.SourceB3COTAHIST)
		return
	}
	var tickers []string
	for _, in := range ins {
		if in.Exchange == "B3" && in.QuoteCurrency == pivot {
			tickers = append(tickers, string(in.Code))
		}
	}
	if len(tickers) == 0 {
		return
	}
	today := m.feeds.Clock.Today()
	from, err := m.feedStart(ctx, domain.SourceB3COTAHIST, "", today)
	if err != nil {
		m.logFeed(ctx, err, "source", domain.SourceB3COTAHIST)
		return
	}
	for d := from; !d.After(today); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}
		quotes, err := src.Fetch(ctx, d, tickers)
		if errors.Is(err, feed.ErrNoData) {
			continue
		}
		if err == nil {
			err = m.storeQuotes(ctx, domain.SourceB3COTAHIST, quotes)
		}
		if err != nil {
			m.logFeed(ctx, err, "source", domain.SourceB3COTAHIST, "day", d.Format(time.DateOnly))
			return
		}
	}
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
