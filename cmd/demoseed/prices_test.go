package main

import (
	"net/http"
	"testing"
)

// The trades of the demo are priced from the instance: the last price on or before the date wins, and an
// instrument without prices keeps the synthetic series.
func TestPriceOnReadsInstancePrices(t *testing.T) {
	s := investmentsHarness(t)
	for date, value := range map[string]string{"2026-01-02": "40.00", "2026-01-09": "42.00"} {
		recordPrice(s, "ITUB4", date, value)
	}

	s.postPrices()
	s.loadPrices()

	if s.err != nil {
		t.Fatal(s.err)
	}

	for _, tc := range []struct {
		date string
		want float64
	}{
		{"2026-01-02", 40},
		{"2026-01-05", 40},
		{"2026-01-09", 42},
		{"2026-01-12", 42},
	} {
		if got := s.priceOn("ITUB4", day(tc.date)); got != tc.want {
			t.Errorf("priceOn(ITUB4, %s) = %v, want %v", tc.date, got, tc.want)
		}
	}

	if got := s.priceOn("PETR4", day("2026-01-05")); got <= 0 {
		t.Errorf("priceOn(PETR4) = %v, want the synthetic fallback above zero", got)
	}
}

func investmentsHarness(t *testing.T) *seeder {
	t.Helper()

	s, cfg, _ := seedHarness(t, testToday)
	s.start = firstOfMonth(cfg.today).AddDate(0, -historyMonths, 0)
	s.today = cfg.today
	s.loadSystemAccounts()
	s.loadHolidays()
	s.requireEmpty()
	s.localizeSystemAccounts()
	s.buildChart(iso(s.start))
	s.buildInvestments(iso(s.start))

	return s
}

func recordPrice(s *seeder, code, date, value string) {
	s.do(
		http.MethodPost,
		"/prices",
		map[string]any{"instrument": code, "quote_instrument": "BRL", "date": date, "value": value},
		nil,
	)
}
