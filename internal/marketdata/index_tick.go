package marketdata

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

const (
	// indexWindowDays bounds one fetch: the SGS refuses a daily series over ten years, and five
	// years leave room.
	indexWindowDays = 1825
	// indexHistoryYears is how far back an enabled index is fetched (calculators design §6).
	indexHistoryYears = 20
	// indexWholeReadDays is the age of a whole read that repeats it (A265 RI1).
	indexWholeReadDays = 7
)

// tickIndex fetches the rates of an index: its whole history when wholeReadDue, the days after the
// latest stored rate otherwise. A first fetch starts 20 years before today, at the earliest issue
// date of a security that follows the index, or at the history start of the source, whichever is
// earliest. On a failure the next tick fetches the same days.
func (m *Module) tickIndex(ctx context.Context, src index.Source) error {
	start, err := m.indexStart(ctx, src)
	if err != nil {
		return err
	}

	today := m.feeds.Clock.Today(ctx)

	whole, err := m.wholeReadDue(ctx, src.Index(), start, today)
	if err != nil {
		return err
	}

	from := start
	if !whole {
		latest, err := m.q.LatestIndexRate(ctx, src.Index())
		if err != nil {
			return err
		}

		from = latest.Latest.AddDate(0, 0, 1)
	}

	if err := m.fetchRates(ctx, src, from, today); err != nil {
		return err
	}

	missing, err := m.missingRates(ctx, src)
	if err != nil {
		return err
	}

	if !whole {
		return m.q.SetIndexMissing(
			ctx,
			postgres.SetIndexMissingParams{IndexID: src.Index(), Missing: missing},
		)
	}

	return m.q.SetIndexCheck(ctx, postgres.SetIndexCheckParams{
		IndexID:   src.Index(),
		FromDate:  start,
		CheckedOn: today,
		Missing:   missing,
	})
}

// indexStart is the first day the store of src holds.
func (m *Module) indexStart(ctx context.Context, src index.Source) (time.Time, error) {
	followed := src.Index()

	issued, err := m.q.IndexTermsStart(ctx, &followed)
	if err != nil {
		return time.Time{}, err
	}

	from := m.feeds.Clock.Today(ctx).AddDate(-indexHistoryYears, 0, 0)
	if issued.N > 0 && issued.IssuedOn.Before(from) {
		from = issued.IssuedOn
	}

	if since := historySince(src); !since.IsZero() && since.Before(from) {
		from = since
	}

	return from, nil
}

// historySince is the history start src declares, zero when it declares none.
func historySince(src index.Source) time.Time {
	if h, ok := src.(index.HistoryStart); ok {
		return h.HistorySince()
	}

	return time.Time{}
}

// wholeReadDue reports whether the whole history of an index is to be read: it never was, its start
// moved back, the last whole read is indexWholeReadDays old or, at most once a day, a hole remains
// (A265 RI1).
func (m *Module) wholeReadDue(
	ctx context.Context,
	id string,
	start, today time.Time,
) (bool, error) {
	checks, err := m.q.IndexCheck(ctx, id)
	if err != nil {
		return false, fmt.Errorf("read the last whole read of %s: %w", id, err)
	}

	if len(checks) == 0 {
		return true, nil
	}

	c := checks[0]

	age := today.Sub(c.CheckedOn)

	return start.Before(c.FromDate) || age >= indexWholeReadDays*24*time.Hour ||
		(c.Missing > 0 && age > 0), nil
}

// fetchRates fetches and stores the rates of src in [from, to], one window at a time.
func (m *Module) fetchRates(ctx context.Context, src index.Source, from, to time.Time) error {
	for !from.After(to) {
		end := from.AddDate(0, 0, indexWindowDays)
		if end.After(to) {
			end = to
		}

		rates, err := src.Fetch(ctx, from, end)
		if storeErr := m.storeRates(ctx, src, rates); err == nil {
			err = storeErr
		}

		if err != nil {
			return err
		}

		from = end.AddDate(0, 0, 1)
	}

	return nil
}

// storeRates writes the rates that are new or differ from the stored ones. A rate written before
// the latest stored one deletes the accrued prices over it, which the next accrual computes again
// (A265 RI2).
func (m *Module) storeRates(ctx context.Context, src index.Source, rates []index.Rate) error {
	if len(rates) == 0 {
		return nil
	}

	latest, err := m.q.LatestIndexRate(ctx, src.Index())
	if err != nil {
		return err
	}

	stored, err := m.storedRates(ctx, src.Index(), rates)
	if err != nil {
		return err
	}

	var (
		revised int
		since   time.Time
	)

	var fresh []index.Rate

	for _, r := range rates {
		if same(stored[r.Date], r.Value) {
			continue
		}

		fresh = append(fresh, r)

		if !latest.Found || r.Date.After(latest.Latest) {
			continue
		}

		revised++

		if since.IsZero() || r.Date.Before(since) {
			since = r.Date
		}
	}

	if err := m.writeRates(ctx, src, fresh); err != nil || revised == 0 {
		return err
	}

	return m.revisedRates(ctx, src.Index(), revised, since)
}

// revisedRates states in the log that rates of an index before its latest one were written, from
// since on, and deletes the accrued prices over them.
func (m *Module) revisedRates(
	ctx context.Context,
	id string,
	rates int,
	since time.Time,
) error {
	m.feeds.Log.InfoContext(ctx, "index revised",
		"index", id, "rates", rates, "from", since.Format(time.DateOnly))

	return m.q.DeleteAccruedOfIndex(ctx, postgres.DeleteAccruedOfIndexParams{
		IndexID:  optional(id),
		Source:   sourceAccrual,
		FromDate: since,
	})
}

// storedRates are the stored rates of an index over the dates of rates, by date.
func (m *Module) storedRates(
	ctx context.Context,
	id string,
	rates []index.Rate,
) (map[time.Time]string, error) {
	from, to := rates[0].Date, rates[0].Date
	for _, r := range rates {
		if r.Date.Before(from) {
			from = r.Date
		}

		if r.Date.After(to) {
			to = r.Date
		}
	}

	rows, err := m.q.ListIndexRatesBetween(
		ctx,
		postgres.ListIndexRatesBetweenParams{IndexID: id, FromDate: from, ToDate: to},
	)
	if err != nil {
		return nil, fmt.Errorf("list the rates of %s: %w", id, err)
	}

	out := make(map[time.Time]string, len(rows))

	for _, r := range rows {
		v, err := r.Rate.Value()
		if err != nil {
			return nil, fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
		}

		out[r.Date] = fmt.Sprint(v)
	}

	return out, nil
}

// same reports whether two decimal texts are one number; an empty text is none.
func same(a, b string) bool {
	x, okX := new(big.Rat).SetString(a)
	y, okY := new(big.Rat).SetString(b)

	return okX && okY && x.Cmp(y) == 0
}

// writeRates writes rates in one transaction.
func (m *Module) writeRates(ctx context.Context, src index.Source, rates []index.Rate) error {
	return pgx.BeginFunc(ctx, m.pool, func(tx pgx.Tx) error {
		q := m.q.WithTx(tx)

		for _, r := range rates {
			var value pgtype.Numeric
			if err := value.Scan(r.Value); err != nil {
				return fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
			}

			if err := q.UpsertIndexRate(ctx, postgres.UpsertIndexRateParams{
				IndexID: src.Index(),
				Date:    r.Date,
				Rate:    value,
				Source:  src.ID(),
			}); err != nil {
				return fmt.Errorf("store the rate of %s: %w", r.Date.Format(time.DateOnly), err)
			}
		}

		return nil
	})
}

// missingRates counts the expected days of an index between its first and its last stored rate
// that have none (A265 RI3).
func (m *Module) missingRates(ctx context.Context, src index.Source) (int32, error) {
	dates, err := m.q.ListIndexDates(ctx, src.Index())
	if err != nil {
		return 0, fmt.Errorf("list the dates of %s: %w", src.Index(), err)
	}

	if len(dates) < 2 {
		return 0, nil
	}

	expected, err := m.expectedDay(ctx, src, dates[0], dates[len(dates)-1])
	if err != nil {
		return 0, err
	}

	var missing int32

	for i := 1; i < len(dates); i++ {
		missing += expected(dates[i-1], dates[i])
	}

	return missing, nil
}

// longestClosure is the longest run of days without a rate that holds no hole of a daily index
// without a calendar: a weekend beside the holidays around it (A265 RI3).
const longestClosure = 6 * 24 * time.Hour

// expectedDay returns the function that counts the days of src without a rate between two
// consecutive stored dates, both exclusive.
func (m *Module) expectedDay(
	ctx context.Context,
	src index.Source,
	from, to time.Time,
) (func(prev, next time.Time) int32, error) {
	if src.Period() == index.PeriodMonth {
		return monthsBetween, nil
	}

	name := calendarOf(src)
	if name == "" {
		return func(prev, next time.Time) int32 {
			if next.Sub(prev) <= longestClosure {
				return 0
			}

			return daysBetween(prev, next, weekday)
		}, nil
	}

	business, err := m.businessDayOf(ctx, name, from, to)
	if err != nil {
		return nil, err
	}

	return func(prev, next time.Time) int32 { return daysBetween(prev, next, business) }, nil
}

// calendarOf is the calendar src declares, empty when it declares none.
func calendarOf(src index.Source) string {
	if c, ok := src.(index.Calendared); ok {
		return c.Calendar()
	}

	return ""
}

// monthsBetween counts the months between the months of prev and next, both exclusive.
func monthsBetween(prev, next time.Time) int32 {
	var n int32

	for d := prev.AddDate(0, 1, 0); d.Before(next); d = d.AddDate(0, 1, 0) {
		n++
	}

	return n
}

// daysBetween counts the days between prev and next, both exclusive, that keep holds for.
func daysBetween(prev, next time.Time, keep func(time.Time) bool) int32 {
	var n int32

	for d := prev.AddDate(0, 0, 1); d.Before(next); d = d.AddDate(0, 0, 1) {
		if keep(d) {
			n++
		}
	}

	return n
}

func weekday(d time.Time) bool {
	return d.Weekday() != time.Saturday && d.Weekday() != time.Sunday
}
