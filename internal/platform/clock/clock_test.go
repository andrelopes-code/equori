package clock

import (
	"testing"
	"time"
)

func TestToday(t *testing.T) {
	t.Parallel()
	saoPaulo, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatal(err)
	}
	// 2026-11-01 01:30 UTC is still 2026-10-31 22:30 in São Paulo (UTC−3).
	instant := time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC)
	c := New(saoPaulo, func() time.Time { return instant })

	if got, want := c.Today(), time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC); !got.Equal(want) || got.Location() != time.UTC {
		t.Fatalf("Today() = %v, want %v", got, want)
	}
	if got := New(time.UTC, func() time.Time { return instant }).Today(); got.Day() != 1 {
		t.Fatalf("Today() in UTC = %v, want day 1", got)
	}
	if got := c.Now(); !got.Equal(instant) || got.Location() != time.UTC {
		t.Fatalf("Now() = %v, want %v in UTC", got, instant)
	}
}
