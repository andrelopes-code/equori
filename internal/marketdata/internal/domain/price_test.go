package domain

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestPriority(t *testing.T) {
	t.Parallel()

	unofficial := UnofficialSources{"yahoo_chart"}

	tests := []struct {
		source  string
		want    int16
		wantErr bool
	}{
		{source: "manual", want: 1},
		{source: "csv", want: 2},
		{source: "bcb_ptax", want: 3},
		{source: "accrual", want: 4},
		{source: "yahoo_chart", want: 5},
		{source: "BCB", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.source, func(t *testing.T) {
			got, err := Priority(tt.source, unofficial)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, want error %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Fatalf("priority = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestPriceInterval(t *testing.T) {
	t.Parallel()

	from := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	tests := []struct {
		to   string
		want string
	}{
		{"2021-02-04", "day"},
		{"2021-02-05", "week"},
		{"2030-01-08", "week"},
		{"2030-01-09", "month"},
	}

	for _, tt := range tests {
		t.Run(tt.to, func(t *testing.T) {
			t.Parallel()

			to, err := time.Parse(time.DateOnly, tt.to)
			if err != nil {
				t.Fatal(err)
			}

			if got := PriceInterval(from, to); got != tt.want {
				t.Fatalf("PriceInterval(%s) = %q, want %q", tt.to, got, tt.want)
			}
		})
	}
}

func TestValidRange(t *testing.T) {
	t.Parallel()

	from := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)

	if err := ValidRange(from, time.Date(2050, 2, 7, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("18300 days: %v", err)
	}

	err := ValidRange(from, time.Date(2050, 2, 8, 0, 0, 0, 0, time.UTC))

	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "to" {
		t.Fatalf("18301 days: err = %v, want field to", err)
	}
}

func TestDownsample(t *testing.T) {
	t.Parallel()

	var in []Price
	for _, p := range []struct{ date, value string }{
		{"2020-01-06", "1"}, {"2020-01-08", "2"}, {"2020-01-13", "3"},
		{"2025-12-29", "5"}, {"2026-01-01", "4"}, {"2026-01-31", "6"},
	} {
		d, err := time.Parse(time.DateOnly, p.date)
		if err != nil {
			t.Fatal(err)
		}

		v, err := money.ParseRate(p.value)
		if err != nil {
			t.Fatal(err)
		}

		in = append(in, Price{Date: d, Value: v})
	}

	tests := []struct {
		interval string
		want     []string
	}{
		{"day", []string{"2020-01-06", "2020-01-08", "2020-01-13", "2025-12-29", "2026-01-01", "2026-01-31"}},
		{"week", []string{"2020-01-08", "2020-01-13", "2026-01-01", "2026-01-31"}},
		{"month", []string{"2020-01-13", "2025-12-29", "2026-01-31"}},
	}

	for _, tt := range tests {
		t.Run(tt.interval, func(t *testing.T) {
			t.Parallel()

			var got []string
			for _, p := range Downsample(in, tt.interval) {
				got = append(got, p.Date.Format(time.DateOnly))
			}

			if !slices.Equal(got, tt.want) {
				t.Fatalf("Downsample(%s) = %v, want %v", tt.interval, got, tt.want)
			}
		})
	}
}
