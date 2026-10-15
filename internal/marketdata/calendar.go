package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
)

// CalendarBRBanking is the Brazilian banking calendar: non-business days of
// Resolução CMN 4.880/2020 plus instance-defined holidays (P2 plan, A4).
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

// Easter returns Easter Sunday of the Gregorian calendar (Meeus/Jones/Butcher algorithm).
func Easter(year int) time.Time {
	a := year % 19
	b, c := year/100, year%100
	d, e := b/4, b%4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i, k := c/4, c%4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := (h+l-7*m+114)%31 + 1
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}

func ruleHolidays(year int) []Holiday {
	fixed := func(m time.Month, d int, name string) Holiday {
		return Holiday{Date: time.Date(year, m, d, 0, 0, 0, 0, time.UTC), Name: name, Source: "rule"}
	}
	easter := Easter(year)
	moving := func(offset int, name string) Holiday {
		return Holiday{Date: easter.AddDate(0, 0, offset), Name: name, Source: "rule"}
	}
	hs := []Holiday{
		fixed(time.January, 1, "New Year's Day"),
		moving(-48, "Carnival Monday"),
		moving(-47, "Carnival Tuesday"),
		moving(-2, "Good Friday"),
		fixed(time.April, 21, "Tiradentes"),
		fixed(time.May, 1, "Labour Day"),
		moving(60, "Corpus Christi"),
		fixed(time.September, 7, "Independence Day"),
		fixed(time.October, 12, "Our Lady of Aparecida"),
		fixed(time.November, 2, "All Souls' Day"),
		fixed(time.November, 15, "Republic Proclamation Day"),
		fixed(time.December, 25, "Christmas Day"),
	}
	if year >= 2024 { // Lei 14.759/2023
		hs = append(hs, fixed(time.November, 20, "Black Consciousness Day"))
	}
	slices.SortFunc(hs, func(a, b Holiday) int { return a.Date.Compare(b.Date) })
	return hs
}

func (m *Module) Holidays(ctx context.Context, name string, year int) ([]Holiday, error) {
	if name != CalendarBRBanking {
		return nil, fmt.Errorf("%w: %q", ErrUnknownCalendar, name)
	}
	hs := ruleHolidays(year)
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
	if name != CalendarBRBanking {
		return false, fmt.Errorf("%w: %q", ErrUnknownCalendar, name)
	}
	if wd := d.Weekday(); wd == time.Saturday || wd == time.Sunday {
		return false, nil
	}
	for _, h := range ruleHolidays(d.Year()) {
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
