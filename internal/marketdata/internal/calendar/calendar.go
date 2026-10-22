// Package calendar declares business-day calendars as rule tables.
package calendar

import (
	"slices"
	"time"
)

type Calendar struct {
	ID      string
	Weekend []time.Weekday
	Rules   []Rule
}

// Rule is one holiday. From and To bound the years it applies to; zero means unbounded.
type Rule struct {
	Name     string
	Date     DateRule
	Observed Observed
	From, To int
}

type Holiday struct {
	Date time.Time
	Name string
}

// Holidays returns the holidays of year sorted by date.
func (c Calendar) Holidays(year int) []Holiday {
	var out []Holiday
	for _, r := range c.Rules {
		if (r.From != 0 && year < r.From) || (r.To != 0 && year > r.To) {
			continue
		}
		out = append(out, Holiday{Date: r.Observed.apply(r.Date.dateIn(year)), Name: r.Name})
	}
	slices.SortStableFunc(out, func(a, b Holiday) int { return a.Date.Compare(b.Date) })
	return out
}

func (c Calendar) IsWeekend(d time.Time) bool {
	return slices.Contains(c.Weekend, d.Weekday())
}

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
