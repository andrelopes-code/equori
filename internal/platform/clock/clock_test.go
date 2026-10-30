package clock

import (
	"context"
	"testing"
	"time"
)

func TestToday(t *testing.T) {
	t.Parallel()

	saoPaulo := mustLocation(t, "America/Sao_Paulo")
	tokyo := mustLocation(t, "Asia/Tokyo")
	bg := context.Background()

	tests := []struct {
		name    string
		ctx     context.Context
		instant time.Time
		want    time.Time
	}{
		{
			name:    "São Paulo",
			ctx:     WithLocation(bg, saoPaulo),
			instant: time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC),
			want:    time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "Tokyo",
			ctx:     WithLocation(bg, tokyo),
			instant: time.Date(2026, 10, 30, 20, 0, 0, 0, time.UTC),
			want:    time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "no location",
			ctx:     bg,
			instant: time.Date(2026, 10, 30, 20, 0, 0, 0, time.UTC),
			want:    time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "nil location",
			ctx:     WithLocation(bg, nil),
			instant: time.Date(2026, 10, 30, 20, 0, 0, 0, time.UTC),
			want:    time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := New(func() time.Time { return tt.instant })

			got := c.Today(tt.ctx)
			if !got.Equal(tt.want) || got.Location() != time.UTC {
				t.Fatalf("Today() = %v, want %v in UTC", got, tt.want)
			}
		})
	}
}

func TestNow(t *testing.T) {
	t.Parallel()

	instant := time.Date(2026, 11, 1, 1, 30, 0, 0, mustLocation(t, "America/Sao_Paulo"))
	c := New(func() time.Time { return instant })

	got := c.Now()
	if !got.Equal(instant) || got.Location() != time.UTC {
		t.Fatalf("Now() = %v, want %v in UTC", got, instant)
	}
}

func mustLocation(t *testing.T, name string) *time.Location {
	t.Helper()

	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Fatal(err)
	}

	return loc
}
