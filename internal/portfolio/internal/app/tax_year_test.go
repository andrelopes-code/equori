package app_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

type aprilYear struct{ domain.Jurisdiction }

func (aprilYear) TaxYear(year int) (time.Time, time.Time) {
	return time.Date(year, 4, 6, 0, 0, 0, 0, time.UTC), time.Date(year+1, 4, 6, 0, 0, 0, 0, time.UTC)
}

type fixedJurisdiction struct{ j domain.Jurisdiction }

func (f fixedJurisdiction) For(context.Context, int64) (domain.Jurisdiction, error) { return f.j, nil }

func TestTaxYear(t *testing.T) {
	t.Parallel()
	day := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
	for _, c := range []struct {
		name     string
		j        domain.Jurisdiction
		contains map[time.Time]bool
		from, to time.Time
	}{
		{
			name: "jurisdiction starting on 6 April", j: aprilYear{},
			from: day(2026, 4, 6), to: day(2027, 4, 6),
			contains: map[time.Time]bool{day(2026, 4, 10): true, day(2026, 4, 5): false},
		},
		{
			name: "no jurisdiction is the calendar year", j: nil,
			from: day(2026, 1, 1), to: day(2027, 1, 1),
			contains: map[time.Time]bool{day(2026, 4, 5): true, day(2027, 1, 1): false},
		},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			svc := app.NewService(nil, nil, nil, fixedJurisdiction{c.j})
			from, to, err := svc.TaxYear(t.Context(), 1, 2026)
			if err != nil {
				t.Fatal(err)
			}
			if !from.Equal(c.from) || !to.Equal(c.to) {
				t.Fatalf("range = %v to %v, want %v to %v", from, to, c.from, c.to)
			}
			for d, want := range c.contains {
				if got := !d.Before(from) && d.Before(to); got != want {
					t.Errorf("%v in year 2026 = %v, want %v", d.Format(time.DateOnly), got, want)
				}
			}
		})
	}
}
