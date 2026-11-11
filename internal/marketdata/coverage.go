package marketdata

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// Coverage reports the stored prices of in and the sources that quote it (A222 MQ23, MQ24).
func (m *Module) Coverage(ctx context.Context, in Instrument) (domain.Coverage, error) {
	var quote *string
	if in.QuoteCurrency != "" {
		q := string(in.QuoteCurrency)
		quote = &q
	}

	all, err := m.q.InstrumentCoverage(ctx, postgres.InstrumentCoverageParams{Instrument: string(in.Code), QuoteInstrument: quote})
	if err != nil {
		return domain.Coverage{}, fmt.Errorf("read the coverage of %s: %w", in.Code, err)
	}

	stored, err := m.storedSources(ctx, string(in.Code))
	if err != nil {
		return domain.Coverage{}, err
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return domain.Coverage{}, err
	}

	cov := domain.Coverage{Count: int(all.Days), Sources: []domain.SourceCoverage{}}
	if all.Days > 0 {
		cov.First, cov.Last = &all.First, &all.Last
	}

	lags := make(map[string]int)
	official := make(map[string]bool)

	for _, e := range sourceEntries() {
		lags[e.id], official[e.id] = e.lag, e.official
	}

	lag := -1

	for _, src := range m.feeds.Sources {
		if len(src.Codes(feedInstruments([]Instrument{in}))) == 0 {
			continue
		}

		sc := stored[src.ID()]
		sc.ID, sc.Enabled, sc.Official = src.ID(), on[src.ID()], official[src.ID()]
		cov.Sources = append(cov.Sources, sc)

		if sc.Enabled && (lag < 0 || lags[src.ID()] < lag) {
			lag = lags[src.ID()]
		}
	}

	cov.Stale = cov.Last != nil && lag >= 0 && overdue(*cov.Last, lag, m.feeds.Clock.Today(ctx))

	return cov, nil
}

// storedSources reads, per source, the first and last stored date and the history request of code.
func (m *Module) storedSources(ctx context.Context, code string) (map[string]domain.SourceCoverage, error) {
	rows, err := m.q.SourceCoverage(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("read the coverage of %s per source: %w", code, err)
	}

	requests, err := m.q.ListInstrumentHistory(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("list the history of %s: %w", code, err)
	}

	out := make(map[string]domain.SourceCoverage)

	for _, r := range rows {
		out[r.Source] = domain.SourceCoverage{First: &r.First, Last: &r.Last}
	}

	for _, r := range requests {
		sc := out[r.Source]
		sc.History = &domain.History{From: r.FromDate, Done: r.DoneAt != nil}

		if r.Error != nil {
			sc.History.Error = *r.Error
		}

		out[r.Source] = sc
	}

	return out, nil
}
