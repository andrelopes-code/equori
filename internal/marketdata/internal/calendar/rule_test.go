package calendar_test

import (
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/calendar"
)

func TestRules(t *testing.T) {
	cal := calendar.Calendar{ID: "test", Weekend: []time.Weekday{time.Saturday, time.Sunday}, Rules: []calendar.Rule{
		{Name: "Memorial", Date: calendar.NthWeekday{Month: time.May, Weekday: time.Monday, N: -1}},
		{Name: "Independence", Date: calendar.Fixed{Month: time.July, Day: 4}, Observed: calendar.ObservedNearestWeekday},
		{Name: "Christmas", Date: calendar.Fixed{Month: time.December, Day: 25}, Observed: calendar.ObservedNextWorkday},
		{Name: "New", Date: calendar.Fixed{Month: time.March, Day: 1}, From: 2024},
	}}
	dates := func(year int) []string {
		var out []string
		for _, h := range cal.Holidays(year) {
			out = append(out, h.Date.Format(time.DateOnly))
		}
		return out
	}
	if got := dates(2026); !slices.Equal(got, []string{"2026-03-01", "2026-05-25", "2026-07-03", "2026-12-25"}) {
		t.Errorf("2026 = %v", got)
	}
	if got := dates(2022); !slices.Equal(got, []string{"2022-05-30", "2022-07-04", "2022-12-26"}) {
		t.Errorf("2022 = %v", got)
	}
}

func TestBRBankingMatchesThePreviousRules(t *testing.T) {
	got := calendar.BRBanking().Holidays(2026)
	if len(got) != 13 || got[3].Name != "Good Friday" || got[3].Date.Format(time.DateOnly) != "2026-04-03" {
		t.Fatalf("2026 = %v", got)
	}
	if len(calendar.BRBanking().Holidays(2023)) != 12 {
		t.Fatal("Black Consciousness Day must start in 2024")
	}
}

func TestEasterOffsetAndWeekend(t *testing.T) {
	if got := calendar.Easter(2026).Format(time.DateOnly); got != "2026-04-05" {
		t.Errorf("Easter 2026 = %s", got)
	}
	if !calendar.Weekend().IsWeekend(time.Date(2026, 4, 25, 0, 0, 0, 0, time.UTC)) {
		t.Error("2026-04-25 is a Saturday")
	}
	if calendar.Weekend().IsWeekend(time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)) {
		t.Error("2026-04-21 is a Tuesday")
	}
	if len(calendar.Weekend().Holidays(2026)) != 0 {
		t.Error("weekend calendar has no holidays")
	}
}
