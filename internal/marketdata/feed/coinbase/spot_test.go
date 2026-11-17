package coinbase_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/coinbase"
)

const (
	ethTicker = `{"trades":[{"price":"3088.45","time":"2026-11-12T15:12:57.844217Z"}],` +
		`"best_bid":"3088.4","best_ask":"3088.5"}`
	ethSpot = "ETH USD 3088.45 at 2026-11-12T15:12:57.844217Z date 2026-11-12 open"
)

func TestCurrent(t *testing.T) {
	t.Parallel()

	var (
		eth   = feed.Instrument{Code: "ETH", Type: "crypto", QuoteCurrency: "USD"}
		btc   = feed.Instrument{Code: "BTC", Type: "crypto", QuoteCurrency: "BRL"}
		apple = feed.Instrument{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"}
	)

	tests := []struct {
		name     string
		in       feed.Instrument
		status   int
		body     string
		quotes   []string
		scope    string
		limited  bool
		requests []string
	}{
		{
			name: "last trade", in: eth, status: 200, body: ethTicker,
			quotes: []string{ethSpot}, requests: []string{"/products/ETH-USD/ticker?limit=1"},
		},
		{
			name: "unknown product", in: btc, status: 404,
			requests: []string{"/products/BTC-BRL/ticker?limit=1"},
		},
		{
			name: "refused product", in: btc, status: 400, body: refused,
			requests: []string{"/products/BTC-BRL/ticker?limit=1"},
		},
		{
			name: "no trade", in: eth, status: 200, body: `{"trades":[]}`,
			requests: []string{"/products/ETH-USD/ticker?limit=1"},
		},
		{
			name: "server error", in: eth, status: 500, scope: "instrument ETH",
			requests: []string{"/products/ETH-USD/ticker?limit=1"},
		},
		{
			name: "rate limited", in: eth, status: 429, limited: true,
			requests: []string{"/products/ETH-USD/ticker?limit=1"},
		},
		{name: "not crypto", in: apple},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var (
				mu       sync.Mutex
				requests []string
			)

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					mu.Lock()

					requests = append(requests, r.URL.RequestURI())
					mu.Unlock()

					w.WriteHeader(tc.status)
					_, _ = w.Write([]byte(tc.body))
				}),
			)
			t.Cleanup(srv.Close)

			src := coinbase.New(srv.Client(), srv.URL, at("2026-11-12T15:13:00Z"))

			got, err := src.Current(t.Context(), []feed.Instrument{tc.in})

			assertSpotError(t, err, tc.scope, tc.limited)

			if lines := spotLines(got); !slices.Equal(lines, tc.quotes) {
				t.Fatalf("quotes = %v, want %v", lines, tc.quotes)
			}

			if !slices.Equal(requests, tc.requests) {
				t.Fatalf("requests = %v, want %v", requests, tc.requests)
			}
		})
	}
}

func spotLines(quotes []feed.SpotQuote) []string {
	var lines []string

	for _, q := range quotes {
		state := "closed"
		if q.Open {
			state = "open"
		}

		lines = append(lines, fmt.Sprintf("%s %s %s at %s date %s %s",
			q.Instrument, q.Quote, q.Value.String(), q.At.Format(time.RFC3339Nano),
			q.Date.Format(time.DateOnly), state))
	}

	return lines
}

func assertSpotError(t *testing.T, err error, scope string, limited bool) {
	t.Helper()

	var (
		status     *feed.StatusError
		scopeError *feed.ScopeError
	)

	switch {
	case limited:
		if !errors.As(err, &status) || status.Code != http.StatusTooManyRequests ||
			errors.As(err, &scopeError) {
			t.Fatalf("err = %v, want a bare 429 status error", err)
		}
	case scope != "":
		if !errors.As(err, &scopeError) || scopeError.Key+" "+scopeError.Value != scope {
			t.Fatalf("err = %v, want scope %s", err, scope)
		}
	case err != nil:
		t.Fatal(err)
	}
}
