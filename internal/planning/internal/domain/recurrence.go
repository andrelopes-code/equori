package domain

import "time"

type Frequency string

const (
	Daily   Frequency = "daily"
	Weekly  Frequency = "weekly"
	Monthly Frequency = "monthly"
	Yearly  Frequency = "yearly"
)

// Rule generates the dates of a schedule (T01, T02, T06; P7 amendment A48).
type Rule struct {
	Frequency Frequency
	Interval  int
	// Monthly selectors, exactly one: DayOfMonth (1–31, −1 last day), Weekday with Ordinal
	// (1–5, −1 last) or BusinessDayOrdinal (1–23, −1 last).
	DayOfMonth         int
	Weekday            *time.Weekday
	Ordinal            int
	BusinessDayOrdinal int
	// Adjustment moves a date off non-business days: none (also when empty), following,
	// preceding, modified_following. It never applies to BusinessDayOrdinal.
	Adjustment string
	Start      time.Time
	Until      *time.Time // inclusive
	Count      int        // 0 is unlimited
}

// BusinessDays reports whether a date is a business day: weekends and holidays are not.
type BusinessDays interface {
	IsBusinessDay(d time.Time) bool
}

// Dated is one date of a rule; Sequence counts the dates of the rule from Start, from 1.
type Dated struct {
	Sequence int
	Date     time.Time
}

// maxShift bounds an adjustment, as in marketdata.
const maxShift = 15

func (r Rule) Validate() error {
	switch r.Frequency {
	case Daily, Weekly, Monthly, Yearly:
	default:
		return invalid("recurrence.frequency", "must be daily, weekly, monthly or yearly")
	}
	if r.Interval < 1 {
		return invalid("recurrence.interval", "must be at least 1")
	}
	selectors := 0
	if r.DayOfMonth != 0 {
		selectors++
		if r.DayOfMonth != -1 && (r.DayOfMonth < 1 || r.DayOfMonth > 31) {
			return invalid("recurrence.day_of_month", "must be between 1 and 31, or -1")
		}
	}
	if r.Weekday != nil || r.Ordinal != 0 {
		selectors++
		if r.Ordinal != -1 && (r.Ordinal < 1 || r.Ordinal > 5) {
			return invalid("recurrence.ordinal", "must be between 1 and 5, or -1, with a weekday")
		}
		if r.Weekday == nil {
			return invalid("recurrence.weekday", "is required with an ordinal")
		}
	}
	if r.BusinessDayOrdinal != 0 {
		selectors++
		if r.BusinessDayOrdinal != -1 && (r.BusinessDayOrdinal < 1 || r.BusinessDayOrdinal > 23) {
			return invalid("recurrence.business_day_ordinal", "must be between 1 and 23, or -1")
		}
	}
	if r.Frequency == Monthly && selectors != 1 {
		return invalid("recurrence", "a monthly rule takes exactly one of day_of_month, weekday with ordinal, business_day_ordinal")
	}
	if r.Frequency != Monthly && selectors != 0 {
		return invalid("recurrence", "only a monthly rule takes a day selector")
	}
	switch r.Adjustment {
	case "", "none", "following", "preceding", "modified_following":
	default:
		return invalid("recurrence.adjustment", "must be none, following, preceding or modified_following")
	}
	if r.Until != nil && r.Until.Before(r.Start) {
		return invalid("recurrence.until", "must not be before start")
	}
	if r.Count < 0 {
		return invalid("recurrence.count", "must not be negative")
	}
	return nil
}

// Dates returns the dates of r in [from, to], each with its sequence counted from Start.
// Until and Count apply to the unadjusted dates.
func (r Rule) Dates(from, to time.Time, days BusinessDays) []Dated {
	var out []Dated
	seq := 0
	for k := 0; ; k++ {
		base, ok := r.base(k, days)
		if base.After(to.AddDate(0, 0, maxShift)) || (r.Until != nil && base.After(*r.Until)) {
			return out
		}
		if !ok || base.Before(r.Start) {
			continue
		}
		seq++
		if r.Count > 0 && seq > r.Count {
			return out
		}
		d := base
		if r.BusinessDayOrdinal == 0 {
			d = adjust(base, r.Adjustment, days)
		}
		if !d.Before(from) && !d.After(to) {
			out = append(out, Dated{Sequence: seq, Date: d})
		}
	}
}

// base returns the unadjusted date of step k; ok is false when the step has no date.
func (r Rule) base(k int, days BusinessDays) (time.Time, bool) {
	s := r.Start
	switch r.Frequency {
	case Daily:
		return s.AddDate(0, 0, k*r.Interval), true
	case Weekly:
		return s.AddDate(0, 0, 7*k*r.Interval), true
	case Yearly:
		return dayInMonth(s.Year()+k*r.Interval, s.Month(), s.Day()), true
	}
	first := time.Date(s.Year(), s.Month()+time.Month(k*r.Interval), 1, 0, 0, 0, 0, time.UTC)
	y, m := first.Year(), first.Month()
	switch {
	case r.DayOfMonth == -1:
		return lastDay(y, m), true
	case r.DayOfMonth > 0:
		return dayInMonth(y, m, r.DayOfMonth), true
	case r.Weekday != nil:
		return nthWeekday(y, m, *r.Weekday, r.Ordinal), true
	default:
		return nthBusinessDay(y, m, r.BusinessDayOrdinal, days)
	}
}

func lastDay(y int, m time.Month) time.Time {
	return time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC)
}

// dayInMonth resolves a day that does not exist to the last day of the month (T02).
func dayInMonth(y int, m time.Month, d int) time.Time {
	if last := lastDay(y, m); d > last.Day() {
		return last
	}
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// nthWeekday resolves a missing Nth weekday, and −1, to the last one of the month.
func nthWeekday(y int, m time.Month, w time.Weekday, n int) time.Time {
	first := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	d := first.AddDate(0, 0, (int(w)-int(first.Weekday())+7)%7)
	var last time.Time
	for i := 1; d.Month() == m; i++ {
		if i == n {
			return d
		}
		last = d
		d = d.AddDate(0, 0, 7)
	}
	return last
}

// nthBusinessDay resolves a missing Nth business day, and −1, to the last one of the month;
// a month without business days returns its first day and false, so Dates still advances.
func nthBusinessDay(y int, m time.Month, n int, days BusinessDays) (time.Time, bool) {
	first := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	last, found := first, false
	i := 0
	for d := first; d.Month() == m; d = d.AddDate(0, 0, 1) {
		if !days.IsBusinessDay(d) {
			continue
		}
		i++
		if i == n {
			return d, true
		}
		last, found = d, true
	}
	return last, found
}

func adjust(d time.Time, adjustment string, days BusinessDays) time.Time {
	switch adjustment {
	case "following":
		return shift(d, 1, days)
	case "preceding":
		return shift(d, -1, days)
	case "modified_following":
		if f := shift(d, 1, days); f.Month() == d.Month() {
			return f
		}
		return shift(d, -1, days)
	}
	return d
}

func shift(d time.Time, step int, days BusinessDays) time.Time {
	for i := 0; i <= maxShift && !days.IsBusinessDay(d); i++ {
		d = d.AddDate(0, 0, step)
	}
	return d
}
