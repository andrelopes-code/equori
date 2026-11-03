package app

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// Frequency names of a series, as manage_schedule spells them.
const (
	CadenceWeekly    = "weekly"
	CadenceMonthly   = "monthly"
	CadenceQuarterly = "quarterly"
	CadenceYearly    = "yearly"
)

const (
	// seriesWindowDays is how far back the detector reads transactions (spec 2026-11-03 §6).
	seriesWindowDays = 400
	// seriesRecentIDs is how many transaction IDs a series keeps.
	seriesRecentIDs = 6
)

// cadence is a frequency with the band of median intervals it accepts, inclusive, and the step
// from one date to the next.
type cadence struct {
	name                 string
	minDays, maxDays     int
	years, months, extra int
}

var cadences = []cadence{
	{name: CadenceWeekly, minDays: 6, maxDays: 8, extra: 7},
	{name: CadenceMonthly, minDays: 27, maxDays: 33, months: 1},
	{name: CadenceQuarterly, minDays: 85, maxDays: 97, months: 3},
	{name: CadenceYearly, minDays: 355, maxDays: 375, years: 1},
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

type RecurringFilter struct {
	PayeeID, AccountID uuid.UUID // uuid.Nil: any
	Text               string    // folded match on Key; empty: any
	// Probe, when set, is added to the facts before detection; Recurring then returns only its series.
	Probe *SeriesFact
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

// Recurring returns the series of the book, filtered; ScheduleID is the active schedule that
// covers the series.
func (s *Service) Recurring(ctx context.Context, booksID int64, f RecurringFilter) ([]Series, error) {
	facts, err := s.seriesFacts(ctx, booksID, f.AccountID)
	if err != nil {
		return nil, err
	}

	if f.Probe != nil {
		facts = append(facts, *f.Probe)
	}

	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return nil, err
	}

	today := s.clk.Today(ctx)

	var out []Series

	for _, sr := range DetectSeries(facts) {
		if !f.matches(sr) {
			continue
		}

		sr.ScheduleID = coveringSchedule(sr, schedules, today)
		out = append(out, sr)
	}

	return out, nil
}

func (f RecurringFilter) matches(s Series) bool {
	switch {
	case f.Probe != nil && (s.AccountID != f.Probe.AccountID || s.Key != f.Probe.Key):
		return false
	case f.PayeeID != uuid.Nil && s.PayeeID != f.PayeeID:
		return false
	case f.AccountID != uuid.Nil && s.AccountID != f.AccountID:
		return false
	}

	return strings.Contains(textfold.String(s.Key), textfold.String(f.Text))
}

// seriesFacts reads the expenses of the open balance accounts in the detector window.
func (s *Service) seriesFacts(ctx context.Context, booksID int64, only uuid.UUID) ([]SeriesFact, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	classes := make(map[uuid.UUID]string, len(accounts))
	for _, a := range accounts {
		classes[a.ID] = a.Class
	}

	today := s.clk.Today(ctx)
	from := today.AddDate(0, 0, -seriesWindowDays)

	var out []SeriesFact

	for _, a := range accounts {
		if a.Closed || (a.Class != "asset" && a.Class != "liability") || (only != uuid.Nil && a.ID != only) {
			continue
		}

		ids, err := s.ledger.AccountTransactionsBetween(ctx, booksID, a.ID, from, today)
		if err != nil {
			return nil, err
		}

		txs, err := s.ledger.TransactionFacts(ctx, booksID, ids)
		if err != nil {
			return nil, err
		}

		for _, t := range txs {
			if f, ok := seriesFact(t, a.ID, classes); ok {
				out = append(out, f)
			}
		}
	}

	return out, nil
}

// seriesFact is the expense t books on account: the sum of its expense postings and the expense
// account of the largest one. ok is false for a voided transaction, one without an expense
// amount and one without a payee or description.
func seriesFact(t domain.Transaction, account uuid.UUID, classes map[uuid.UUID]string) (SeriesFact, bool) {
	if t.Voided {
		return SeriesFact{}, false
	}

	var amount, largest int64

	var category uuid.UUID

	for _, p := range t.Postings {
		if classes[p.AccountID] != "expense" {
			continue
		}

		amount += p.Amount

		if p.Amount > largest {
			largest, category = p.Amount, p.AccountID
		}
	}

	key := textfold.String(t.Description)
	if t.PayeeID != uuid.Nil {
		key = t.PayeeID.String()
	}

	if amount <= 0 || key == "" {
		return SeriesFact{}, false
	}

	return SeriesFact{
		TransactionID: t.ID, AccountID: account, CategoryID: category, PayeeID: t.PayeeID,
		Key: key, Date: t.Date, Amount: amount,
	}, true
}

// coveringSchedule is the rule of plan B: an active schedule on the series account with the same
// payee or, without payee, the same folded description. uuid.Nil when none.
func coveringSchedule(s Series, schedules []domain.Schedule, today time.Time) uuid.UUID {
	for _, sch := range schedules {
		if sch.AccountID != s.AccountID || (sch.EndsOn != nil && sch.EndsOn.Before(today)) {
			continue
		}

		if s.PayeeID != uuid.Nil && sch.PayeeID == s.PayeeID {
			return sch.ID
		}

		if s.PayeeID == uuid.Nil && textfold.String(sch.Description) == s.Key {
			return sch.ID
		}
	}

	return uuid.Nil
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
