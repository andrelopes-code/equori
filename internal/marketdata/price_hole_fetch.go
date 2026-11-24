package marketdata

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

const (
	// dayFilesPerCheck bounds the daily files one check asks for (A265 PH4).
	dayFilesPerCheck = 31
	// yearSpanDays is a range that a source with year files reads from them (A222 MQ12).
	yearSpanDays = 32
)

// askYears asks src for each year that holds a hole of a pair it quotes, from its first day to its
// last hole. More than a month makes a source with year files read them, and the last session asked
// is one the file holds, so no daily file of a past year, which the source no longer keeps, is read.
func (m *Module) askYears(
	ctx context.Context,
	src feed.Source,
	holes []*pairHoles,
) error {
	byYear := make(map[int][]*pairHoles)
	last := make(map[int]time.Time)

	for _, h := range holes {
		if !slices.Contains(h.sources, src.ID()) {
			continue
		}

		for _, d := range h.dates {
			if pairs := byYear[d.Year()]; !slices.Contains(pairs, h) {
				byYear[d.Year()] = append(pairs, h)
			}

			if d.After(last[d.Year()]) {
				last[d.Year()] = d
			}
		}
	}

	var failed error

	for year, pairs := range byYear {
		from := time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)
		if early := last[year].AddDate(0, 0, -yearSpanDays); early.Before(from) {
			from = early
		}

		failed = errors.Join(failed, m.askHoles(ctx, src, pairs, from, last[year]))
	}

	return failed
}

// askDays asks a source that keeps daily files for the latest days still without a price; the days
// over dayFilesPerCheck wait for the next check.
func (m *Module) askDays(
	ctx context.Context,
	src feed.Source,
	holes []*pairHoles,
	today time.Time,
) error {
	archive, ok := src.(feed.DayArchive)
	if !ok {
		return nil
	}

	since := today.AddDate(0, 0, -archive.DayArchiveDays())
	byDay := make(map[time.Time][]*pairHoles)

	for _, h := range holes {
		if !slices.Contains(h.sources, src.ID()) {
			continue
		}

		for _, d := range h.dates {
			if !d.Before(since) {
				byDay[d] = append(byDay[d], h)
			}
		}
	}

	days := make([]time.Time, 0, len(byDay))
	for d := range byDay {
		days = append(days, d)
	}

	slices.SortFunc(days, func(a, b time.Time) int { return b.Compare(a) })

	var failed error

	for i, d := range days {
		if i < dayFilesPerCheck {
			failed = errors.Join(failed, m.askHoles(ctx, src, byDay[d], d, d))
			continue
		}

		for _, h := range byDay[d] {
			h.waiting = append(h.waiting, d)
		}
	}

	return failed
}

// askHoles fetches [from, to] of the pairs from src, stores the prices of their holes and drops them
// from the pairs. A pair the source failed for is marked.
func (m *Module) askHoles(
	ctx context.Context,
	src feed.Source,
	pairs []*pairHoles,
	from, to time.Time,
) error {
	ins := make([]feed.Instrument, len(pairs))
	for i, h := range pairs {
		ins[i] = h.instrument
	}

	codes := src.Codes(ins)

	quotes, err := src.Fetch(ctx, codes, from, to)
	m.logFetchError(ctx, src.ID(), err)

	failures := historyFailures(err, codes)

	var found []feed.Quote

	for _, h := range pairs {
		if _, ok := failures[h.instrument.Code]; ok {
			h.failed = true
			continue
		}

		found = append(found, h.take(quotes)...)
	}

	return errors.Join(err, m.storeQuotes(ctx, src.ID(), found))
}

// take returns the quotes of the holes of h and drops these holes.
func (h *pairHoles) take(quotes []feed.Quote) []feed.Quote {
	var out []feed.Quote

	for _, q := range quotes {
		if q.Instrument != h.instrument.Code || q.Quote != h.quote {
			continue
		}

		if i := slices.IndexFunc(h.dates, q.Date.Equal); i >= 0 {
			h.dates = slices.Delete(h.dates, i, i+1)

			out = append(out, q)
		}
	}

	return out
}
