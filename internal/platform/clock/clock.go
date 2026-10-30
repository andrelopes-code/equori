// Package clock provides the current instant and the accounting date in the location of the
// context (ADR 005, ADR 029 BK19).
package clock

import (
	"context"
	"time"
)

type locationKey struct{}

type Clock struct {
	now func() time.Time
}

func New(now func() time.Time) Clock {
	return Clock{now: now}
}

func (c Clock) Now() time.Time { return c.now().UTC() }

// Today is the calendar date in the location of ctx, as returned by DateOf.
func (c Clock) Today(ctx context.Context) time.Time { return DateOf(c.now(), Location(ctx)) }

// WithLocation returns ctx carrying loc; a nil loc reads as UTC.
func WithLocation(ctx context.Context, loc *time.Location) context.Context {
	return context.WithValue(ctx, locationKey{}, loc)
}

// Location returns the location ctx carries, or UTC without one.
func Location(ctx context.Context) *time.Location {
	if loc, ok := ctx.Value(locationKey{}).(*time.Location); ok && loc != nil {
		return loc
	}

	return time.UTC
}

// DateOf returns the calendar date of t in loc as 00:00 UTC, the in-memory form of
// every accounting date. Comparing two such values compares calendar days.
func DateOf(t time.Time, loc *time.Location) time.Time {
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
