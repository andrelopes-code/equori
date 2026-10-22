package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/calendar"
)

// CalendarBRBanking identifies the Brazilian banking calendar.
const CalendarBRBanking = "br_banking"

var ErrUnknownCalendar = errors.New("unknown calendar")

type Adjustment string

const (
	AdjustNone              Adjustment = "none"
	AdjustFollowing         Adjustment = "following"
	AdjustPreceding         Adjustment = "preceding"
	AdjustModifiedFollowing Adjustment = "modified_following"
)

type Holiday struct {
	Date   time.Time
	Name   string
	Source string // "rule" or "instance"
}

// Calendar answers business-day questions; *Module implements it.
type Calendar interface {
	IsBusinessDay(ctx context.Context, name string, d time.Time) (bool, error)
	Adjust(ctx context.Context, name string, d time.Time, a Adjustment) (time.Time, error)
	Holidays(ctx context.Context, name string, year int) ([]Holiday, error)
}

var _ Calendar = (*Module)(nil)

// Easter returns Easter Sunday of the Gregorian calendar.
func Easter(year int) time.Time { return calendar.Easter(year) }

// Calendars returns the identifiers of the registered calendars in ascending order.
func (m *Module) Calendars() []string { return m.calendars.IDs() }

func (m *Module) calendar(name string) (calendar.Calendar, error) {
	c, err := m.calendars.Get(name)
	if err != nil {
		return calendar.Calendar{}, fmt.Errorf("%w: %q", ErrUnknownCalendar, name)
	}
	return c, nil
}

func (m *Module) Holidays(ctx context.Context, name string, year int) ([]Holiday, error) {
	cal, err := m.calendar(name)
	if err != nil {
		return nil, err
	}
	var hs []Holiday
	for _, h := range cal.Holidays(year) {
		hs = append(hs, Holiday{Date: h.Date, Name: h.Name, Source: "rule"})
	}
	rows, err := m.q.ListInstanceHolidays(ctx, postgres.ListInstanceHolidaysParams{
		Calendar: name,
		FromDate: time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC),
		ToDate:   time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		hs = append(hs, Holiday{Date: r.Date, Name: r.Name, Source: "instance"})
	}
	slices.SortFunc(hs, func(a, b Holiday) int { return a.Date.Compare(b.Date) })
	return hs, nil
}

func (m *Module) IsBusinessDay(ctx context.Context, name string, d time.Time) (bool, error) {
	cal, err := m.calendar(name)
	if err != nil {
		return false, err
	}
	if cal.IsWeekend(d) {
		return false, nil
	}
	for _, h := range cal.Holidays(d.Year()) {
		if h.Date.Equal(d) {
			return false, nil
		}
	}
	instance, err := m.q.IsInstanceHoliday(ctx, postgres.IsInstanceHolidayParams{Calendar: name, Date: d})
	if err != nil {
		return false, err
	}
	return !instance, nil
}

// maxShift bounds the search for a business day; no calendar has 15 consecutive non-business days.
const maxShift = 15

func (m *Module) Adjust(ctx context.Context, name string, d time.Time, a Adjustment) (time.Time, error) {
	switch a {
	case AdjustNone, "":
		if _, err := m.IsBusinessDay(ctx, name, d); err != nil {
			return time.Time{}, err
		}
		return d, nil
	case AdjustFollowing:
		return m.shift(ctx, name, d, 1)
	case AdjustPreceding:
		return m.shift(ctx, name, d, -1)
	case AdjustModifiedFollowing:
		next, err := m.shift(ctx, name, d, 1)
		if err != nil || next.Month() == d.Month() {
			return next, err
		}
		return m.shift(ctx, name, d, -1)
	default:
		return time.Time{}, fmt.Errorf("unknown adjustment %q", a)
	}
}

func (m *Module) shift(ctx context.Context, name string, d time.Time, step int) (time.Time, error) {
	for range maxShift {
		ok, err := m.IsBusinessDay(ctx, name, d)
		if err != nil || ok {
			return d, err
		}
		d = d.AddDate(0, 0, step)
	}
	return time.Time{}, fmt.Errorf("no business day within %d days of %s", maxShift, d.Format(time.DateOnly))
}
