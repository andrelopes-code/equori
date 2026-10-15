package marketdata_test

import (
	"errors"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestEaster(t *testing.T) {
	for year, want := range map[int]string{2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28", 2038: "2038-04-25"} {
		if got := marketdata.Easter(year); !got.Equal(day(want)) {
			t.Errorf("Easter(%d) = %s, want %s", year, got.Format(time.DateOnly), want)
		}
	}
}

func TestBRBanking2026(t *testing.T) {
	m := marketdata.New(pgtest.New(t))
	got, err := m.Holidays(t.Context(), marketdata.CalendarBRBanking, 2026)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21", "2026-05-01", "2026-06-04",
		"2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"}
	if len(got) != len(want) {
		t.Fatalf("holidays = %d, want %d: %v", len(got), len(want), got)
	}
	for i, h := range got {
		if h.Date.Format(time.DateOnly) != want[i] || h.Source != "rule" || h.Name == "" {
			t.Errorf("holiday %d = %+v, want %s from rule", i, h, want[i])
		}
	}
}

func TestConsciousnessDayFrom2024(t *testing.T) {
	m := marketdata.New(pgtest.New(t))
	for d, want := range map[string]bool{"2023-11-20": true, "2024-11-20": false} {
		got, err := m.IsBusinessDay(t.Context(), marketdata.CalendarBRBanking, day(d))
		if err != nil || got != want {
			t.Errorf("IsBusinessDay(%s) = %v, %v; want %v", d, got, err, want)
		}
	}
}

func TestAdjust(t *testing.T) {
	m := marketdata.New(pgtest.New(t))
	tests := []struct {
		in   string
		adj  marketdata.Adjustment
		want string
	}{
		{"2026-12-05", marketdata.AdjustFollowing, "2026-12-07"},
		{"2026-12-05", marketdata.AdjustPreceding, "2026-12-04"},
		{"2026-12-05", marketdata.AdjustNone, "2026-12-05"},
		{"2026-02-17", marketdata.AdjustFollowing, "2026-02-18"},
		{"2026-01-31", marketdata.AdjustModifiedFollowing, "2026-01-30"},
		{"2026-11-10", marketdata.AdjustFollowing, "2026-11-10"},
	}
	for _, tt := range tests {
		got, err := m.Adjust(t.Context(), marketdata.CalendarBRBanking, day(tt.in), tt.adj)
		if err != nil || got.Format(time.DateOnly) != tt.want {
			t.Errorf("Adjust(%s, %s) = %s, %v; want %s", tt.in, tt.adj, got.Format(time.DateOnly), err, tt.want)
		}
	}
}

func TestInstanceHoliday(t *testing.T) {
	pool := pgtest.New(t)
	m := marketdata.New(pool)
	if _, err := pool.Exec(t.Context(), `INSERT INTO marketdata_holiday (calendar, date, name) VALUES ('br_banking', '2026-03-19', 'Local holiday')`); err != nil {
		t.Fatal(err)
	}
	if ok, err := m.IsBusinessDay(t.Context(), marketdata.CalendarBRBanking, day("2026-03-19")); err != nil || ok {
		t.Fatalf("IsBusinessDay(2026-03-19) = %v, %v; want false", ok, err)
	}
	hs, err := m.Holidays(t.Context(), marketdata.CalendarBRBanking, 2026)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, h := range hs {
		if h.Date.Equal(day("2026-03-19")) && h.Source == "instance" {
			found = true
		}
	}
	if !found || len(hs) != 14 {
		t.Fatalf("holidays = %v; want 14 including the instance holiday", hs)
	}
}

func TestUnknownCalendar(t *testing.T) {
	m := marketdata.New(pgtest.New(t))
	if _, err := m.IsBusinessDay(t.Context(), "mars", day("2026-01-02")); !errors.Is(err, marketdata.ErrUnknownCalendar) {
		t.Fatalf("err = %v, want ErrUnknownCalendar", err)
	}
}
