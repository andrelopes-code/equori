package marketdata

import (
	"context"
	"errors"
	"maps"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// yearSpanDays is a range that a source with year files reads from them (A222 MQ12).
const yearSpanDays = 32

// askYears asks src for each year that holds a hole of a pair it quotes, from its first day to its
// last hole. More than a month makes a source with year files read them, and the last session asked
// is one the file holds, so no daily file of a past year, which the source no longer keeps, is read.
// A source with one file per day is never asked by year.
func (m *Module) askYears(
	ctx context.Context,
	src feed.Source,
	holes []*pairHoles,
) error {
	if _, ok := src.(feed.DayArchive); ok {
		return nil
	}

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

// askDays asks a source with one file per day for each day still without a price, the latest first.
// The first failure ends it: the host is down, and the next check asks again.
func (m *Module) askDays(
	ctx context.Context,
	src feed.Source,
	holes []*pairHoles,
) error {
	archive, ok := src.(feed.DayArchive)
	if !ok {
		return nil
	}

	byDay := make(map[time.Time][]*pairHoles)

	for _, h := range holes {
		if !slices.Contains(h.sources, src.ID()) {
			continue
		}

		for _, d := range h.dates {
			if !d.Before(archive.DayArchiveSince()) {
				byDay[d] = append(byDay[d], h)
			}
		}
	}

	days := slices.SortedFunc(maps.Keys(byDay), func(a, b time.Time) int { return b.Compare(a) })

	for i, d := range days {
		err := m.askHoles(ctx, src, byDay[d], d, d)
		if err == nil {
			continue
		}

		for _, rest := range days[i:] {
			for _, h := range byDay[rest] {
				h.failed = true
			}
		}

		return err
	}

	return nil
}

// askHoles fetches [from, to] of the pairs from src, stores the prices of their holes and drops them
// from the pairs, with the sessions its witness states to be without a trade. A pair the source failed
// for is marked.
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

	witness := money.Currency("")
	if w, ok := src.(feed.Witnessed); ok {
		witness = w.Witness()
	}

	quotes, err := src.Fetch(ctx, withWitness(codes, witness), from, to)
	m.logFetchError(ctx, src.ID(), err)

	failures := historyFailures(err, codes)

	var found []feed.Quote

	for _, h := range pairs {
		if _, ok := failures[h.instrument.Code]; ok {
			h.failed = true
			continue
		}

		found = append(found, h.take(quotes)...)
		h.settle(quotes, witness)
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

// settle moves the holes of a session that witness traded at to the ones without a trade; take ran
// before it, so no quote of the pair is left for them.
func (h *pairHoles) settle(quotes []feed.Quote, witness money.Currency) {
	if witness == "" || witness == h.instrument.Code {
		return
	}

	for _, q := range quotes {
		if q.Instrument != witness {
			continue
		}

		if i := slices.IndexFunc(h.dates, q.Date.Equal); i >= 0 {
			h.noTrade = append(h.noTrade, h.dates[i])
			h.dates = slices.Delete(h.dates, i, i+1)
		}
	}
}

// withWitness adds witness to codes when they do not hold it.
func withWitness(codes []money.Currency, witness money.Currency) []money.Currency {
	if witness == "" || slices.Contains(codes, witness) {
		return codes
	}

	return append(slices.Clone(codes), witness)
}
