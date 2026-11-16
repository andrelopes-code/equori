package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type quoteWarningOut struct {
	Instrument string  `json:"instrument"`
	Last       *string `json:"last"`
}

func ptr(s string) *string { return &s }

// S373: a held instrument with a late, missing or later first quote is listed (MQ26).
func TestS373QuoteWarnings(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.PriceFeeds([]string{"b3_consolidated"}, nil))
	f.trade(t, "buy", "2026-10-05", 100, "10.05", 0)
	f.h.Dispatch()

	tests := []struct {
		name   string
		record [2]string
		date   string
		stale  bool
		want   []quoteWarningOut
	}{
		{
			name: "no price",
			date: "2026-11-01",
			want: []quoteWarningOut{{Instrument: "MXRF11"}},
		},
		{
			name:   "last price overdue",
			record: [2]string{"2026-10-20", "9.02"},
			date:   "2026-11-01",
			stale:  true,
			want:   []quoteWarningOut{{Instrument: "MXRF11", Last: ptr("2026-10-20")}},
		},
		{
			name:   "price up to date",
			record: [2]string{"2026-10-30", "9.10"},
			date:   "2026-11-01",
			want:   []quoteWarningOut{},
		},
		{
			name: "first price after the date",
			date: "2026-10-10",
			want: []quoteWarningOut{{Instrument: "MXRF11", Last: ptr("2026-10-30")}},
		},
		{
			name: "no position at the date",
			date: "2026-10-01",
			want: []quoteWarningOut{},
		},
	}
	for _, tt := range tests {
		if tt.record[0] != "" {
			recordMXRF11(t, f, tt.record[0], tt.record[1], "b3_consolidated")
		}

		if tt.stale {
			var in struct {
				Coverage struct {
					Stale bool `json:"stale"`
				} `json:"coverage"`
			}
			f.h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &in)

			if !in.Coverage.Stale {
				t.Fatalf("%s: coverage.stale = false, want true", tt.name)
			}
		}

		if got := quoteWarnings(t, f, tt.date); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%s: quote_warnings = %+v, want %+v", tt.name, got, tt.want)
		}
	}
}

// S373: an instrument that no enabled source quotes is never stale (MQ24).
func TestS373QuoteWarningsWithoutSource(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 100, "10.05", 0)
	f.h.Dispatch()
	recordMXRF11(t, f, "2026-10-20", "9.02", "csv")

	if got := quoteWarnings(t, f, "2026-11-01"); !reflect.DeepEqual(got, []quoteWarningOut{}) {
		t.Errorf("quote_warnings = %+v, want none", got)
	}
}

func recordMXRF11(t *testing.T, f fixture, date, value, source string) {
	t.Helper()

	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}

	v, err := money.ParseRate(value)
	if err != nil {
		t.Fatal(err)
	}

	price := marketdata.Price{Instrument: "MXRF11", Quote: "BRL", Date: d, Value: v, Source: source}
	if err := f.h.App.Marketdata.RecordPrices(
		t.Context(),
		0,
		[]marketdata.Price{price},
	); err != nil {
		t.Fatal(err)
	}
}

func quoteWarnings(t *testing.T, f fixture, date string) []quoteWarningOut {
	t.Helper()

	var out struct {
		Warnings []quoteWarningOut `json:"quote_warnings"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/positions?date="+date, nil, http.StatusOK, &out)

	return out.Warnings
}
