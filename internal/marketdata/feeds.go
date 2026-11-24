package marketdata

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RunFeeds ticks now, then every interval, RetryAfter after a tick in which a feed failed (A265 RI6)
// and at every request for a tick (A222 MQ10), until ctx ends, skipping a tick while a requested one
// runs; then it stops a requested tick and waits for it.
func (m *Module) RunFeeds(ctx context.Context, interval time.Duration) {
	t := time.NewTimer(interval)
	defer t.Stop()
	defer m.refreshes.Wait()
	defer m.stop()

	for {
		wait := interval

		if m.running.CompareAndSwap(false, true) {
			m.again.Store(false)

			start := m.feeds.Clock.Now()
			m.TickFeeds(ctx)

			if m.failedSince(start) {
				wait = min(interval, m.feeds.RetryAfter)
			}

			m.running.Store(false)
		}

		t.Reset(wait)

		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-m.kick:
		}
	}
}

// TickFeeds fetches each enabled source from the day after its latest price (per code), never
// earlier than today − 30 days, to today. Consecutive codes with the same start share one
// fetch. A failure is logged and kept as the feed's state; the next tick fetches the same days
// again.
func (m *Module) TickFeeds(ctx context.Context) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		m.logFeed(ctx, err)
		return
	}

	for _, src := range m.feeds.Sources {
		if on[src.ID()] {
			m.ran(src.ID(), errors.Join(m.tick(ctx, src), m.tickHistory(ctx, src)))
		}
	}

	for _, src := range m.feeds.Indexes {
		if on[src.ID()] {
			err := m.tickIndex(ctx, src)
			if err != nil {
				m.logFeed(ctx, err, "source", src.ID())
			}

			m.ran(src.ID(), err)
		}
	}

	for _, src := range m.feeds.Expectations {
		if on[src.ID()] {
			err := m.tickExpectation(ctx, src)
			if err != nil {
				m.logFeed(ctx, err, "source", src.ID())
			}

			m.ran(src.ID(), err)
		}
	}

	m.tickCurves(ctx, on)

	for _, src := range m.feeds.Institutions {
		if on[src.ID()] {
			err := m.tickInstitution(ctx, src)
			if err != nil {
				m.logFeed(ctx, err, "source", src.ID())
			}

			m.ran(src.ID(), err)
		}
	}

	m.tickReports(ctx, on)

	m.TickAccrual(ctx)
}

// tickReports runs the fund report and the company report sources, then the check of the price holes,
// which needs the prices and the indexes of the tick.
func (m *Module) tickReports(ctx context.Context, on map[string]bool) {
	m.tickFundReports(ctx, on)
	m.tickCompanyReports(ctx, on)

	if err := m.tickHoles(ctx); err != nil {
		m.logFeed(ctx, err)
	}
}

func (m *Module) tick(ctx context.Context, src feed.Source) error {
	list, err := m.ListInstruments(ctx, "")
	if err != nil {
		m.logFeed(ctx, err, "source", src.ID())
		return err
	}

	codes := src.Codes(feedInstruments(list))
	if len(codes) == 0 {
		return nil
	}

	today := m.feeds.Clock.Today(ctx)

	starts := make([]time.Time, len(codes))
	for i, code := range codes {
		starts[i], err = m.feedStart(ctx, src.ID(), code, today)
		if err != nil {
			m.logFeed(ctx, err, "source", src.ID(), "instrument", code)
			return err
		}
	}

	var failed error
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
			failed = errors.Join(failed, err)
		}

		i = j
	}

	return failed
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
func (m *Module) feedStart(
	ctx context.Context,
	source string,
	instrument money.Currency,
	today time.Time,
) (time.Time, error) {
	var code *string
	if instrument != "" {
		s := string(instrument)
		code = &s
	}

	latest, err := m.q.LatestSourceDate(
		ctx,
		postgres.LatestSourceDateParams{Source: source, Instrument: code},
	)
	if err != nil {
		return time.Time{}, err
	}

	earliest := today.AddDate(0, 0, -feedWindowDays)

	return slices.MaxFunc([]time.Time{latest.AddDate(0, 0, 1), earliest}, time.Time.Compare), nil
}

func (m *Module) storeQuotes(ctx context.Context, source string, quotes []feed.Quote) error {
	ps := make([]Price, len(quotes))
	for i, q := range quotes {
		src := source
		if q.Source != "" {
			src = q.Source
		}

		ps[i] = Price{
			Instrument: q.Instrument,
			Quote:      q.Quote,
			Date:       q.Date,
			Value:      q.Value,
			Source:     src,
		}
	}

	return m.upsert(ctx, ps)
}

func (m *Module) logFeed(ctx context.Context, err error, attrs ...any) {
	m.feeds.Log.ErrorContext(ctx, "price feed", append(attrs, "error", err)...)
}

// requestTick asks RunFeeds for a tick: now when none runs, or once more after the running one
// (A222 MQ10).
func (m *Module) requestTick() {
	m.again.Store(true)
	m.wake()
}

// wake sends on kick without blocking; one pending wake-up is enough.
func (m *Module) wake() {
	select {
	case m.kick <- struct{}{}:
	default:
	}
}

// enabledSources returns the price sources the stored settings enable.
func (m *Module) enabledSources(ctx context.Context) ([]feed.Source, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	var out []feed.Source

	for _, src := range m.feeds.Sources {
		if on[src.ID()] {
			out = append(out, src)
		}
	}

	return out, nil
}

func feedInstruments(list []Instrument) []feed.Instrument {
	ins := make([]feed.Instrument, len(list))
	for i, in := range list {
		ins[i] = feed.Instrument{
			Code:          in.Code,
			Type:          in.Type,
			Exchange:      in.Exchange,
			QuoteCurrency: in.QuoteCurrency,
			Symbols:       in.Symbols,
		}
	}

	return ins
}
