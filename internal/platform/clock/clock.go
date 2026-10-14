// Package clock provides the current instant and the current accounting date
// in the instance time zone (ADR 005).
package clock

import "time"

type Clock struct {
	loc *time.Location
	now func() time.Time
}

func New(loc *time.Location, now func() time.Time) Clock {
	return Clock{loc: loc, now: now}
}

func (c Clock) Now() time.Time { return c.now().UTC() }

// Today is the calendar date in the instance time zone, as returned by DateOf.
func (c Clock) Today() time.Time { return DateOf(c.now(), c.loc) }

func (c Clock) Location() *time.Location { return c.loc }

// DateOf returns the calendar date of t in loc as 00:00 UTC, the in-memory form of
// every accounting date. Comparing two such values compares calendar days.
func DateOf(t time.Time, loc *time.Location) time.Time {
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
