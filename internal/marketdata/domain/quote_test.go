package domain

import (
	"testing"
	"time"
)

func TestQuoteReferences(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		today string
		want  quoteDays
	}{
		{
			name:  "plain date",
			today: "2026-11-12",
			want: quoteDays{
				week:       "2026-11-05",
				month:      "2026-10-12",
				quarter:    "2026-08-12",
				year:       "2025-11-12",
				yearToDate: "2025-12-31",
			},
		},
		{
			name:  "month shift clamps to the last day",
			today: "2026-03-31",
			want: quoteDays{
				week:       "2026-03-24",
				month:      "2026-02-28",
				quarter:    "2025-12-31",
				year:       "2025-03-31",
				yearToDate: "2025-12-31",
			},
		},
		{
			name:  "leap day a year back clamps to 28 February",
			today: "2028-02-29",
			want: quoteDays{
				week:       "2028-02-22",
				month:      "2028-01-29",
				quarter:    "2027-11-29",
				year:       "2027-02-28",
				yearToDate: "2027-12-31",
			},
		},
		{
			name:  "first day of the year",
			today: "2026-01-01",
			want: quoteDays{
				week:       "2025-12-25",
				month:      "2025-12-01",
				quarter:    "2025-10-01",
				year:       "2025-01-01",
				yearToDate: "2025-12-31",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			today, err := time.Parse(time.DateOnly, tt.today)
			if err != nil {
				t.Fatal(err)
			}

			got := QuoteReferences(today)
			days := quoteDays{
				week:       got.Week.Format(time.DateOnly),
				month:      got.Month.Format(time.DateOnly),
				quarter:    got.Quarter.Format(time.DateOnly),
				year:       got.Year.Format(time.DateOnly),
				yearToDate: got.YearToDate.Format(time.DateOnly),
			}

			if days != tt.want {
				t.Fatalf("QuoteReferences(%s) = %+v, want %+v", tt.today, days, tt.want)
			}
		})
	}
}

type quoteDays struct {
	week, month, quarter, year, yearToDate string
}
