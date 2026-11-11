package domain

import (
	"cmp"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Frequency names of a series, as manage_schedule spells them.
const (
	CadenceWeekly    = "weekly"
	CadenceMonthly   = "monthly"
	CadenceQuarterly = "quarterly"
	CadenceYearly    = "yearly"
)

// seriesRecentIDs is how many transaction IDs a series keeps.
const seriesRecentIDs = 6

var cadences = []cadence{
	{name: CadenceWeekly, minDays: 6, maxDays: 8, extra: 7},
	{name: CadenceMonthly, minDays: 27, maxDays: 33, months: 1},
	{name: CadenceQuarterly, minDays: 85, maxDays: 97, months: 3},
	{name: CadenceYearly, minDays: 355, maxDays: 375, years: 1},
}

// cadence is a frequency with the band of median intervals it accepts, inclusive, and the step
// from one date to the next.
type cadence struct {
	name                 string
	minDays, maxDays     int
	years, months, extra int
}

// SeriesFact is one expense of a balance account, the input of DetectSeries.
type SeriesFact struct {
	TransactionID, AccountID, CategoryID, PayeeID uuid.UUID
	Key                                           string // payee ID text, or the folded description
	Date                                          time.Time
	Amount                                        int64 // minor units, > 0
}

// Series is a recurring expense found by DetectSeries (spec 2026-11-03 §6).
type Series struct {
	Key                            string
	AccountID, CategoryID, PayeeID uuid.UUID
	Frequency                      string
	Count                          int
	LastDate, NextDate             time.Time
	LastAmount                     int64
	TransactionIDs                 []uuid.UUID // most recent first, at most 6
	ScheduleID                     uuid.UUID   // uuid.Nil when no schedule covers it
}

// DetectSeries groups facts by (AccountID, Key) and returns the qualifying series, most recent
// LastDate first.
func DetectSeries(facts []SeriesFact) []Series {
	type groupKey struct {
		account uuid.UUID
		key     string
	}

	groups := make(map[groupKey][]SeriesFact)
	for _, f := range facts {
		k := groupKey{f.AccountID, f.Key}
		groups[k] = append(groups[k], f)
	}

	var out []Series

	for _, g := range groups {
		if s, ok := detectGroup(g); ok {
			out = append(out, s)
		}
	}

	slices.SortFunc(out, func(a, b Series) int {
		return cmp.Or(
			b.LastDate.Compare(a.LastDate),
			cmp.Compare(a.Key, b.Key),
			strings.Compare(a.AccountID.String(), b.AccountID.String()),
		)
	})

	return out
}

func detectGroup(g []SeriesFact) (Series, bool) {
	if len(g) < 2 {
		return Series{}, false
	}

	g = slices.SortedStableFunc(slices.Values(g), func(a, b SeriesFact) int { return a.Date.Compare(b.Date) })

	intervals := make([]int, len(g)-1)
	for i := range intervals {
		intervals[i] = daysBetween(g[i].Date, g[i+1].Date)
	}

	c, ok := cadenceOf(intervals)
	if !ok || len(g) < 3 && c.name != CadenceMonthly && c.name != CadenceYearly || !amountsClose(g) {
		return Series{}, false
	}

	inBand := 0

	for _, d := range intervals {
		if d >= c.minDays && d <= c.maxDays {
			inBand++
		}
	}

	if inBand*100 < 75*len(intervals) {
		return Series{}, false
	}

	last := g[len(g)-1]

	return Series{
		Key: last.Key, AccountID: last.AccountID, CategoryID: commonCategory(g), PayeeID: last.PayeeID,
		Frequency: c.name, Count: len(g), LastDate: last.Date,
		NextDate:   last.Date.AddDate(c.years, c.months, c.extra),
		LastAmount: last.Amount, TransactionIDs: recentIDs(g),
	}, true
}

// cadenceOf returns the cadence whose band holds the median of intervals (the lower middle for
// an even count).
func cadenceOf(intervals []int) (cadence, bool) {
	median := slices.Sorted(slices.Values(intervals))[(len(intervals)-1)/2]

	for _, c := range cadences {
		if median >= c.minDays && median <= c.maxDays {
			return c, true
		}
	}

	return cadence{}, false
}

// amountsClose reports whether the largest amount is at most 1.25 times the smallest.
func amountsClose(g []SeriesFact) bool {
	lo, hi := g[0].Amount, g[0].Amount
	for _, f := range g {
		lo, hi = min(lo, f.Amount), max(hi, f.Amount)
	}

	return hi*100 <= lo*125
}

// commonCategory is the most frequent category of g, a tie going to the most recent one.
func commonCategory(g []SeriesFact) uuid.UUID {
	count := make(map[uuid.UUID]int)
	latest := make(map[uuid.UUID]int)

	for i, f := range g {
		count[f.CategoryID]++
		latest[f.CategoryID] = i
	}

	best := g[len(g)-1].CategoryID
	for id, n := range count {
		if n > count[best] || n == count[best] && latest[id] > latest[best] {
			best = id
		}
	}

	return best
}

// recentIDs returns the IDs of the recorded transactions of g, most recent first.
func recentIDs(g []SeriesFact) []uuid.UUID {
	var out []uuid.UUID

	for i := len(g) - 1; i >= 0 && len(out) < seriesRecentIDs; i-- {
		if g[i].TransactionID != uuid.Nil {
			out = append(out, g[i].TransactionID)
		}
	}

	return out
}

func daysBetween(a, b time.Time) int {
	day := func(t time.Time) time.Time { return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC) }

	return int(day(b).Sub(day(a)) / (24 * time.Hour))
}
