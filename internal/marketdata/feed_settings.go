package marketdata

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

var (
	ErrUnknownFeed    = domain.ErrUnknownFeed
	ErrAdminRequired  = domain.ErrAdminRequired
	ErrRefreshRunning = domain.ErrRefreshRunning
)

type Feed = domain.Feed

// Admins tells whether a user may change the instance (identity).
type Admins interface {
	IsAdmin(ctx context.Context, userID int64) (bool, error)
}

// WithAdmins sets who may change the feeds; the composition root calls it once.
func (m *Module) WithAdmins(a Admins) *Module {
	m.admins = a
	return m
}

// feedRun is the outcome of the last tick that ran a feed (ADR 025 F5).
type feedRun struct {
	at  time.Time
	err string
}

func (m *Module) ran(id string, err error) {
	run := feedRun{at: m.feeds.Clock.Now()}
	if err != nil {
		run.err = err.Error()
	}
	m.runsMu.Lock()
	defer m.runsMu.Unlock()
	if m.runs == nil {
		m.runs = make(map[string]feedRun)
	}
	m.runs[id] = run
}

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
	l, err := m.profiles.Profile(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	suggested := SuggestedFeeds(l.Region)
	lags := feedLags()
	out := make([]Feed, 0, len(m.feeds.Sources)+len(m.feeds.Indexes))
	for _, src := range m.feeds.Sources {
		latest, err := m.q.LatestSourceDate(ctx, postgres.LatestSourceDateParams{Source: src.ID()})
		if err != nil {
			return nil, fmt.Errorf("read the latest price of %s: %w", src.ID(), err)
		}
		var last *time.Time
		if latest.After(time.Unix(0, 0).UTC()) {
			last = &latest
		}
		out = append(out, m.feed(src.ID(), domain.FeedPrice, index.PeriodDay, last, on, suggested, lags))
	}
	for _, src := range m.feeds.Indexes {
		latest, err := m.q.LatestIndexRate(ctx, src.Index())
		if err != nil {
			return nil, fmt.Errorf("read the latest rate of %s: %w", src.ID(), err)
		}
		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}
		out = append(out, m.feed(src.ID(), domain.FeedIndex, src.Period(), last, on, suggested, lags))
	}
	for _, src := range m.feeds.Expectations {
		latest, err := m.q.LatestSurvey(ctx, src.ID())
		if err != nil {
			return nil, fmt.Errorf("read the latest survey of %s: %w", src.ID(), err)
		}
		var last *time.Time
		if latest.Found {
			last = &latest.Latest
		}
		out = append(out, m.feed(src.ID(), domain.FeedExpectation, index.PeriodDay, last, on, suggested, lags))
	}
	return out, nil
}

func (m *Module) feed(id, kind, period string, last *time.Time, on map[string]bool, suggested []string, lags map[string]int) Feed {
	f := Feed{ID: id, Kind: kind, Enabled: on[id], Suggested: slices.Contains(suggested, id), Last: last}
	if f.Enabled && last != nil {
		// The period of last is published; the one due is the next, ending two periods after last.
		due := last.AddDate(0, 0, 2+lags[id])
		if period == index.PeriodMonth {
			due = last.AddDate(0, 2, lags[id])
		}
		f.Stale = m.feeds.Clock.Today().After(due)
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
	return lags
}

// SetFeed enables or disables a feed for the instance (ADR 025 F6). The first stored setting
// stores the seed with it, so a write never changes the state of another feed.
func (m *Module) SetFeed(ctx context.Context, id string, enabled bool) (Feed, error) {
	if err := m.requireAdmin(ctx); err != nil {
		return Feed{}, err
	}
	if _, ok := feedLags()[id]; !ok {
		return Feed{}, ErrUnknownFeed
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
	fs, err := m.Feeds(ctx)
	if err != nil {
		return Feed{}, err
	}
	i := slices.IndexFunc(fs, func(f Feed) bool { return f.ID == id })
	return fs[i], nil
}

// Refresh starts a tick that outlives the request (ADR 025 F7).
func (m *Module) Refresh(ctx context.Context) error {
	if err := m.requireAdmin(ctx); err != nil {
		return err
	}
	if !m.running.CompareAndSwap(false, true) {
		return ErrRefreshRunning
	}
	m.refreshes.Go(func() {
		defer m.running.Store(false)
		m.TickFeeds(m.life)
	})
	return nil
}

// WaitRefresh returns when no requested tick runs.
func (m *Module) WaitRefresh() { m.refreshes.Wait() }

func (m *Module) requireAdmin(ctx context.Context) error {
	ok, err := m.admins.IsAdmin(ctx, auth.MustUserID(ctx))
	if err != nil {
		return err
	}
	if !ok {
		return ErrAdminRequired
	}
	return nil
}
