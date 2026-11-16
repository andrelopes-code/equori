package marketdata

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// enabledFeeds is the set of ADR 025 F2: the stored settings, or the seed while none is stored.
func (m *Module) enabledFeeds(ctx context.Context) (map[string]bool, error) {
	rows, err := m.q.ListFeeds(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the feed settings: %w", err)
	}

	on := make(map[string]bool)
	if len(rows) == 0 {
		for _, id := range m.feeds.Seed {
			on[id] = true
		}

		return on, nil
	}

	for _, r := range rows {
		on[r.ID] = r.Enabled
	}

	return on, nil
}

// Feeds lists every feed of the registry, price sources, then index and expectation sources, with
// its state (ADR 025 F5).
func (m *Module) Feeds(ctx context.Context) ([]Feed, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	l, err := m.profiles.Profile(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	instruments, err := m.ListInstruments(ctx, "")
	if err != nil {
		return nil, err
	}

	pending, err := m.pendingHistory(ctx)
	if err != nil {
		return nil, err
	}

	suggested := SuggestedFeeds(l.Region)
	lags := feedLags()
	feedIns := feedInstruments(instruments)

	fs := feedState{on: on, suggested: suggested, lags: lags}

	out := make([]Feed, 0, len(m.feeds.Sources)+len(m.feeds.Indexes))

	out, err = m.priceFeeds(ctx, out, fs, feedIns, pending)
	if err != nil {
		return nil, err
	}

	out, err = m.indexFeeds(ctx, out, fs)
	if err != nil {
		return nil, err
	}

	out, err = m.expectationFeeds(ctx, out, fs)
	if err != nil {
		return nil, err
	}

	out, err = m.institutionFeeds(ctx, out, fs)
	if err != nil {
		return nil, err
	}

	return out, nil
}

// feedState holds what every feed row of Feeds shares: the enabled ids, the ids suggested for the
// region and the lag of each source.
type feedState struct {
	on        map[string]bool
	suggested []string
	lags      map[string]int
}

// priceFeeds appends the price sources to out.
func (m *Module) priceFeeds(
	ctx context.Context,
	out []Feed,
	fs feedState,
	feedIns []feed.Instrument,
	pending map[string]int,
) ([]Feed, error) {
	for _, src := range m.feeds.Sources {
		latest, err := m.q.LatestSourceDate(ctx, postgres.LatestSourceDateParams{Source: src.ID()})
		if err != nil {
			return nil, fmt.Errorf("read the latest price of %s: %w", src.ID(), err)
		}

		var last *time.Time
		if latest.After(time.Unix(0, 0).UTC()) {
			last = &latest
		}

		f := m.feed(
			ctx,
			src.ID(),
			domain.FeedPrice,
			index.PeriodDay,
			last,
			fs.on,
			fs.suggested,
			fs.lags,
		)
		f.Covers = len(src.Codes(feedIns))
		f.HistoryPending = pending[src.ID()]
		_, f.SymbolOverride = src.(feed.SymbolOverride)

		out = append(out, f)
	}

	return out, nil
}

// indexFeeds appends the index sources to out.
func (m *Module) indexFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.Indexes {
		latest, err := m.q.LatestIndexRate(ctx, src.Index())
		if err != nil {
			return nil, fmt.Errorf("read the latest rate of %s: %w", src.ID(), err)
		}

		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}

		out = append(
			out,
			m.feed(
				ctx,
				src.ID(),
				domain.FeedIndex,
				src.Period(),
				last,
				fs.on,
				fs.suggested,
				fs.lags,
			),
		)
	}

	return out, nil
}

// expectationFeeds appends the expectation sources to out.
func (m *Module) expectationFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	for _, src := range m.feeds.Expectations {
		latest, err := m.q.LatestSurvey(ctx, src.ID())
		if err != nil {
			return nil, fmt.Errorf("read the latest survey of %s: %w", src.ID(), err)
		}

		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}

		out = append(
			out,
			m.feed(
				ctx,
				src.ID(),
				domain.FeedExpectation,
				index.PeriodDay,
				last,
				fs.on,
				fs.suggested,
				fs.lags,
			),
		)
	}

	return out, nil
}

func (m *Module) feed(
	ctx context.Context,
	id, kind, period string,
	last *time.Time,
	on map[string]bool,
	suggested []string,
	lags map[string]int,
) Feed {
	f := Feed{
		ID: id, Kind: kind, Enabled: on[id], Suggested: slices.Contains(suggested, id), Last: last,
		Official: !slices.Contains(unofficialSources(), id),
	}
	if f.Enabled && last != nil {
		// The period of last is published; the one due is the next, ending two periods after last.
		today := m.feeds.Clock.Today(ctx)

		f.Stale = overdue(*last, lags[id], today)
		if period == index.PeriodMonth {
			f.Stale = today.After(last.AddDate(0, 2, lags[id]))
		}

		if period == periodQuarter {
			f.Stale = today.After(quarterEndAfter(*last).AddDate(0, 0, lags[id]))
		}
	}

	m.runsMu.Lock()
	run, ok := m.runs[id]
	m.runsMu.Unlock()

	if ok {
		f.LastRun = &run.at
		if run.err != "" {
			f.Error = &run.err
		}
	}

	return f
}

// pendingHistory counts the history requests not yet done, by source ID.
func (m *Module) pendingHistory(ctx context.Context) (map[string]int, error) {
	rows, err := m.q.CountPendingHistory(ctx)
	if err != nil {
		return nil, fmt.Errorf("count the pending history: %w", err)
	}

	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.Source] = int(r.Pending)
	}

	return out, nil
}

// overdue reports whether today is past the day the daily price after last is due (ADR 025 F9).
func overdue(last time.Time, lag int, today time.Time) bool {
	return today.After(last.AddDate(0, 0, 2+lag))
}

// quarterEndAfter returns the last day of the quarter after the one that ends on last (A237 I8).
func quarterEndAfter(last time.Time) time.Time {
	return time.Date(last.Year(), last.Month()+4, 0, 0, 0, 0, 0, time.UTC)
}

func feedLags() map[string]int {
	lags := make(map[string]int)
	for _, e := range sourceEntries() {
		lags[e.id] = e.lag
	}

	for _, e := range indexEntries() {
		lags[e.id] = e.lag
	}

	for _, e := range expectationEntries() {
		lags[e.id] = e.lag
	}

	for _, e := range institutionEntries() {
		lags[e.id] = e.lag
	}

	return lags
}

// SetFeed enables or disables a feed for the instance (ADR 025 F6). The first stored setting
// stores the seed with it, so a write never changes the state of another feed. Enabling a source
// whose prices rank last needs acceptUnofficial (A222 MQ22).
func (m *Module) SetFeed(
	ctx context.Context,
	id string,
	enabled, acceptUnofficial bool,
) (Feed, error) {
	if err := m.requireAdmin(ctx); err != nil {
		return Feed{}, err
	}

	if _, ok := feedLags()[id]; !ok {
		return Feed{}, ErrUnknownFeed
	}

	if enabled && !acceptUnofficial && slices.Contains(unofficialSources(), id) {
		return Feed{}, ErrUnofficialSource
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return Feed{}, err
	}

	on[id] = enabled

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return Feed{}, err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	for fid, en := range on {
		if err := q.SetFeed(ctx, postgres.SetFeedParams{ID: fid, Enabled: en}); err != nil {
			return Feed{}, fmt.Errorf("store the setting of %s: %w", fid, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Feed{}, err
	}

	if enabled {
		m.requestFeedHistory(ctx, id)
	}

	fs, err := m.Feeds(ctx)
	if err != nil {
		return Feed{}, err
	}

	i := slices.IndexFunc(fs, func(f Feed) bool { return f.ID == id })

	return fs[i], nil
}
