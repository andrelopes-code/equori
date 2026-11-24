package marketdata

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

const (
	// lateBusinessDays and lateWeekdays are the days without a rate after the last one of a daily
	// index, with and without a calendar, past which it is stale (A265 RI5).
	lateBusinessDays = 2
	lateWeekdays     = 3
)

// indexFeeds appends the index sources to out.
func (m *Module) indexFeeds(ctx context.Context, out []Feed, fs feedState) ([]Feed, error) {
	missing, err := m.missingByIndex(ctx)
	if err != nil {
		return nil, err
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

		f := m.feed(
			ctx,
			src.ID(),
			domain.FeedIndex,
			src.Period(),
			last,
			fs.on,
			fs.suggested,
			fs.lags,
		)

		if f.Enabled {
			if f, err = m.withReadState(ctx, f, src, missing); err != nil {
				return nil, err
			}
		}

		out = append(out, f)
	}

	return out, nil
}

// withReadState sets on the feed of an enabled index its holes and whether it is late. An index that was
// never read whole is loading: it counts as a pending history and is not late (A265 RI4).
func (m *Module) withReadState(
	ctx context.Context,
	f Feed,
	src index.Source,
	missing map[string]int,
) (Feed, error) {
	holes, read := missing[src.Index()]
	if !read {
		f.HistoryPending = 1
		f.Stale = f.Stale && src.Period() == index.PeriodMonth

		return f, nil
	}

	f.Missing = holes

	if f.Last == nil || src.Period() != index.PeriodDay {
		return f, nil
	}

	late, err := m.lateIndex(ctx, src, *f.Last)
	f.Stale = late

	return f, err
}

// missingByIndex is the number of expected days without a rate of each index (A265 RI4).
func (m *Module) missingByIndex(ctx context.Context) (map[string]int, error) {
	checks, err := m.q.ListIndexChecks(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the whole reads of the indexes: %w", err)
	}

	out := make(map[string]int, len(checks))
	for _, c := range checks {
		out[c.IndexID] = int(c.Missing)
	}

	return out, nil
}

// lateIndex reports whether the days between the last rate of a daily index and today hold more
// business days than its publication takes (A265 RI5).
func (m *Module) lateIndex(
	ctx context.Context,
	src index.Source,
	last time.Time,
) (bool, error) {
	today := m.feeds.Clock.Today(ctx)

	name := calendarOf(src)
	if name == "" {
		return daysBetween(last, today, weekday) > lateWeekdays, nil
	}

	business, err := m.businessDayOf(ctx, name, last, today)
	if err != nil {
		return false, err
	}

	return daysBetween(last, today, business) > lateBusinessDays, nil
}

// unofficialFeed reports whether id is a source that publishes no terms for this use (A222 MQ1,
// A265 MI5).
func unofficialFeed(id string) bool {
	return slices.Contains(unofficialSources(), id) ||
		slices.ContainsFunc(
			indexEntries(),
			func(e indexEntry) bool { return e.id == id && e.unofficial },
		)
}
