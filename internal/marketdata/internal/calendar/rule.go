package calendar

import "time"

type DateRule interface{ dateIn(year int) time.Time }

type Fixed struct {
	Month time.Month
	Day   int
}

func (f Fixed) dateIn(year int) time.Time {
	return time.Date(year, f.Month, f.Day, 0, 0, 0, 0, time.UTC)
}

type EasterOffset struct{ Days int }

func (e EasterOffset) dateIn(year int) time.Time { return Easter(year).AddDate(0, 0, e.Days) }

// NthWeekday is the Nth Weekday of Month; N = -1 is the last.
type NthWeekday struct {
	Month   time.Month
	Weekday time.Weekday
	N       int
}

func (n NthWeekday) dateIn(year int) time.Time {
	if n.N < 0 {
		last := time.Date(year, n.Month+1, 0, 0, 0, 0, 0, time.UTC)
		back := (int(last.Weekday()) - int(n.Weekday) + 7) % 7
		return last.AddDate(0, 0, -back-7*(-n.N-1))
	}
	first := time.Date(year, n.Month, 1, 0, 0, 0, 0, time.UTC)
	fwd := (int(n.Weekday) - int(first.Weekday()) + 7) % 7
	return first.AddDate(0, 0, fwd+7*(n.N-1))
}

type Observed int

const (
	ObservedNone Observed = iota
	ObservedNearestWeekday
	ObservedNextWorkday
)

func (o Observed) apply(d time.Time) time.Time {
	switch o {
	case ObservedNearestWeekday:
		switch d.Weekday() {
		case time.Saturday:
			return d.AddDate(0, 0, -1)
		case time.Sunday:
			return d.AddDate(0, 0, 1)
		}
	case ObservedNextWorkday:
		switch d.Weekday() {
		case time.Saturday:
			return d.AddDate(0, 0, 2)
		case time.Sunday:
			return d.AddDate(0, 0, 1)
		}
	}
	return d
}
