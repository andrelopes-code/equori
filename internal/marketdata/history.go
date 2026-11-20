package marketdata

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

var earliestHistoryStart = time.Date(1900, time.January, 1, 0, 0, 0, 0, time.UTC)

// RequestHistory queues the prices of code since from from each enabled price source that
// quotes it and asks for a tick (A222 MQ8, MQ10).
func (m *Module) RequestHistory(ctx context.Context, code string, from time.Time) error {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return err
	}

	if from.Before(earliestHistoryStart) || from.After(m.feeds.Clock.Today(ctx)) {
		return &domain.FieldError{Field: "from", Message: "must be between 1900-01-01 and today"}
	}

	sources, err := m.enabledSources(ctx)
	if err != nil {
		return err
	}

	n, err := m.requestHistory(
		ctx,
		sources,
		feedInstruments([]Instrument{in}),
		func(string) time.Time { return from },
	)
	if err != nil {
		return err
	}

	if n == 0 {
		return ErrNoSource
	}

	return nil
}

// requestHistory queues, for each source of sources, the codes it quotes among ins from the
// start that from gives, and asks for a tick when it queued a row (A222 MQ5, MQ10). It returns
// the number of rows requested.
func (m *Module) requestHistory(
	ctx context.Context,
	sources []feed.Source,
	ins []feed.Instrument,
	from func(source string) time.Time,
) (int, error) {
	if len(sources) == 0 {
		return 0, nil
	}

	now := m.feeds.Clock.Now()
	n := 0

	for _, src := range sources {
		start := from(src.ID())

		for _, code := range src.Codes(ins) {
			err := m.q.RequestHistory(ctx, postgres.RequestHistoryParams{
				Source:      src.ID(),
				Instrument:  string(code),
				FromDate:    start,
				RequestedAt: now,
			})
			if err != nil {
				return n, fmt.Errorf("request the history of %s from %s: %w", code, src.ID(), err)
			}

			if err := m.reopenHole(ctx, src.ID(), string(code), start, now); err != nil {
				return n, err
			}

			n++
		}
	}

	if n > 0 {
		m.requestTick()
	}

	return n, nil
}

// reopenHole queues a finished history of source and instrument again from from when its stored
// prices from there hold a hole: a request over prices already stored changes nothing (A222 MQ5),
// one over a hole fetches it (A248 CQ4b).
func (m *Module) reopenHole(
	ctx context.Context,
	source, instrument string,
	from, now time.Time,
) error {
	dates, err := m.storedDates(ctx, source, instrument, from)
	if err != nil || len(dates) == 0 || lastRun(dates) == 0 {
		return err
	}

	err = m.q.ReopenHistory(ctx, postgres.ReopenHistoryParams{
		Source:      source,
		Instrument:  instrument,
		FromDate:    from,
		RequestedAt: now,
	})
	if err != nil {
		return fmt.Errorf("reopen the history of %s from %s: %w", instrument, source, err)
	}

	return nil
}

// requestDefaultHistory requests the default history of in from every enabled source that
// quotes it; a failure is logged, the operation that called it still succeeds (D11).
func (m *Module) requestDefaultHistory(ctx context.Context, in Instrument) {
	sources, err := m.enabledSources(ctx)
	if err == nil {
		_, err = m.requestHistory(
			ctx,
			sources,
			feedInstruments([]Instrument{in}),
			m.defaultStart(ctx),
		)
	}

	if err != nil {
		m.logFeed(ctx, err, "instrument", string(in.Code))
	}
}

// defaultStart is today minus the history years of the source's entry (A222 MQ6).
func (m *Module) defaultStart(ctx context.Context) func(source string) time.Time {
	years := make(map[string]int)
	for _, e := range sourceEntries() {
		years[e.id] = e.historyYears
	}

	return func(source string) time.Time {
		return m.feeds.Clock.Today(ctx).AddDate(-years[source], 0, 0)
	}
}

// requestFeedHistory requests the default history of every instrument from the price source id,
// when it is one; a failure is logged, enabling the feed still succeeds (D11).
func (m *Module) requestFeedHistory(ctx context.Context, id string) {
	i := slices.IndexFunc(m.feeds.Sources, func(s feed.Source) bool { return s.ID() == id })
	if i < 0 {
		return
	}

	list, err := m.ListInstruments(ctx, "")
	if err == nil {
		_, err = m.requestHistory(
			ctx,
			m.feeds.Sources[i:i+1],
			feedInstruments(list),
			m.defaultStart(ctx),
		)
	}

	if err != nil {
		m.logFeed(ctx, err, "source", id)
	}
}
