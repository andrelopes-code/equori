package domain

import (
	"errors"
	"slices"
	"testing"
	"time"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func days(ss ...string) []time.Time {
	out := make([]time.Time, len(ss))
	for i, s := range ss {
		out[i] = day(s)
	}
	return out
}

// holidays is a business-day set with weekends and the listed dates off.
type holidays []time.Time

func (h holidays) IsBusinessDay(d time.Time) bool {
	if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		return false
	}
	return !slices.ContainsFunc(h, d.Equal)
}

// brazil holds the national holidays the cases below cross.
var brazil = holidays(days("2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25", "2027-01-01", "2027-02-08", "2027-02-09"))

func weekday(w time.Weekday) *time.Weekday { return &w }

func ptr(t time.Time) *time.Time { return &t }

func TestRuleDates(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		rule     Rule
		from, to string
		want     []Dated
	}{
		{
			name: "S27 monthly on day 5 following",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 5, Adjustment: "following", Start: day("2026-11-01")},
			from: "2026-11-01", to: "2027-01-31",
			want: []Dated{{1, day("2026-11-05")}, {2, day("2026-12-07")}, {3, day("2027-01-05")}},
		},
		{
			name: "S28 day 31 without adjustment",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 31, Start: day("2027-01-31")},
			from: "2027-01-01", to: "2027-04-30",
			want: []Dated{{1, day("2027-01-31")}, {2, day("2027-02-28")}, {3, day("2027-03-31")}, {4, day("2027-04-30")}},
		},
		{
			name: "last day of month in February of a common and a leap year",
			rule: Rule{Frequency: Monthly, Interval: 12, DayOfMonth: -1, Start: day("2027-02-01")},
			from: "2027-01-01", to: "2028-12-31",
			want: []Dated{{1, day("2027-02-28")}, {2, day("2028-02-29")}},
		},
		{
			name: "second Tuesday",
			rule: Rule{Frequency: Monthly, Interval: 1, Weekday: weekday(time.Tuesday), Ordinal: 2, Start: day("2026-11-01")},
			from: "2026-11-01", to: "2026-12-31",
			want: []Dated{{1, day("2026-11-10")}, {2, day("2026-12-08")}},
		},
		{
			name: "last Friday",
			rule: Rule{Frequency: Monthly, Interval: 1, Weekday: weekday(time.Friday), Ordinal: -1, Start: day("2026-11-01")},
			from: "2026-11-01", to: "2026-12-31",
			want: []Dated{{1, day("2026-11-27")}, {2, day("2026-12-25")}},
		},
		{
			name: "fifth Friday missing falls back to the last Friday",
			rule: Rule{Frequency: Monthly, Interval: 1, Weekday: weekday(time.Friday), Ordinal: 5, Start: day("2026-12-01")},
			from: "2026-12-01", to: "2027-01-31",
			want: []Dated{{1, day("2026-12-25")}, {2, day("2027-01-29")}},
		},
		{
			name: "fifth business day across a holiday",
			rule: Rule{Frequency: Monthly, Interval: 1, BusinessDayOrdinal: 5, Start: day("2026-11-01")},
			from: "2026-11-01", to: "2026-12-31",
			want: []Dated{{1, day("2026-11-09")}, {2, day("2026-12-07")}},
		},
		{
			name: "last business day",
			rule: Rule{Frequency: Monthly, Interval: 1, BusinessDayOrdinal: -1, Start: day("2026-12-01")},
			from: "2026-12-01", to: "2027-01-31",
			want: []Dated{{1, day("2026-12-31")}, {2, day("2027-01-29")}},
		},
		{
			name: "23rd business day of February with Carnival falls back to the last business day",
			rule: Rule{Frequency: Monthly, Interval: 1, BusinessDayOrdinal: 23, Start: day("2027-02-01")},
			from: "2027-02-01", to: "2027-02-28",
			want: []Dated{{1, day("2027-02-26")}},
		},
		{
			name: "modified following stays in the month",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 31, Adjustment: "modified_following", Start: day("2027-01-01")},
			from: "2027-01-01", to: "2027-01-31",
			want: []Dated{{1, day("2027-01-29")}},
		},
		{
			name: "preceding moves a Sunday back",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 1, Adjustment: "preceding", Start: day("2026-10-01")},
			from: "2026-10-15", to: "2026-11-15",
			want: []Dated{{2, day("2026-10-30")}},
		},
		{
			name: "weekly every two weeks on the weekday of start",
			rule: Rule{Frequency: Weekly, Interval: 2, Start: day("2026-11-04")},
			from: "2026-11-01", to: "2026-12-01",
			want: []Dated{{1, day("2026-11-04")}, {2, day("2026-11-18")}},
		},
		{
			name: "yearly from February 29",
			rule: Rule{Frequency: Yearly, Interval: 1, Start: day("2028-02-29")},
			from: "2028-01-01", to: "2030-12-31",
			want: []Dated{{1, day("2028-02-29")}, {2, day("2029-02-28")}, {3, day("2030-02-28")}},
		},
		{
			name: "daily every three days",
			rule: Rule{Frequency: Daily, Interval: 3, Start: day("2026-11-01")},
			from: "2026-11-01", to: "2026-11-10",
			want: []Dated{{1, day("2026-11-01")}, {2, day("2026-11-04")}, {3, day("2026-11-07")}, {4, day("2026-11-10")}},
		},
		{
			name: "until is inclusive",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 10, Start: day("2026-11-01"), Until: ptr(day("2027-01-10"))},
			from: "2026-11-01", to: "2027-12-31",
			want: []Dated{{1, day("2026-11-10")}, {2, day("2026-12-10")}, {3, day("2027-01-10")}},
		},
		{
			name: "count limits the dates counted from start",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 10, Start: day("2026-11-01"), Count: 3},
			from: "2026-12-11", to: "2027-12-31",
			want: []Dated{{3, day("2027-01-10")}},
		},
		{
			name: "a selector before start in the first month is skipped",
			rule: Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 5, Start: day("2026-11-12")},
			from: "2026-11-01", to: "2026-12-31",
			want: []Dated{{1, day("2026-12-05")}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.rule.Validate(); err != nil {
				t.Fatalf("Validate() = %v", err)
			}
			got := tt.rule.Dates(day(tt.from), day(tt.to), brazil)
			if !slices.EqualFunc(got, tt.want, func(a, b Dated) bool { return a.Sequence == b.Sequence && a.Date.Equal(b.Date) }) {
				t.Errorf("Dates() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRuleValidate(t *testing.T) {
	t.Parallel()
	start := day("2026-11-01")
	tests := []struct {
		name  string
		rule  Rule
		field string
	}{
		{"two monthly selectors", Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 5, BusinessDayOrdinal: 5, Start: start}, "recurrence"},
		{"no monthly selector", Rule{Frequency: Monthly, Interval: 1, Start: start}, "recurrence"},
		{"selector on weekly", Rule{Frequency: Weekly, Interval: 1, DayOfMonth: 5, Start: start}, "recurrence"},
		{"unknown frequency", Rule{Frequency: "hourly", Interval: 1, Start: start}, "recurrence.frequency"},
		{"interval zero", Rule{Frequency: Daily, Start: start}, "recurrence.interval"},
		{"day 32", Rule{Frequency: Monthly, Interval: 1, DayOfMonth: 32, Start: start}, "recurrence.day_of_month"},
		{"ordinal 6", Rule{Frequency: Monthly, Interval: 1, Weekday: weekday(time.Monday), Ordinal: 6, Start: start}, "recurrence.ordinal"},
		{"weekday without ordinal", Rule{Frequency: Monthly, Interval: 1, Weekday: weekday(time.Monday), Start: start}, "recurrence.ordinal"},
		{"business day 24", Rule{Frequency: Monthly, Interval: 1, BusinessDayOrdinal: 24, Start: start}, "recurrence.business_day_ordinal"},
		{"unknown adjustment", Rule{Frequency: Daily, Interval: 1, Adjustment: "nearest", Start: start}, "recurrence.adjustment"},
		{"until before start", Rule{Frequency: Daily, Interval: 1, Start: start, Until: ptr(day("2026-10-31"))}, "recurrence.until"},
		{"negative count", Rule{Frequency: Daily, Interval: 1, Start: start, Count: -1}, "recurrence.count"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.rule.Validate()
			var fe *FieldError
			if !errors.As(err, &fe) || !errors.Is(err, ErrValidation) {
				t.Fatalf("Validate() = %v, want a field error", err)
			}
			if fe.Field != tt.field {
				t.Errorf("field = %q, want %q", fe.Field, tt.field)
			}
		})
	}
}
