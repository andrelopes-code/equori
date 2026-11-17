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
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	ethCandles = `{"candles":[` +
		`{"start":"1794182400","low":"3010.1","high":"3100.2","open":"3050","close":"3088.45","volume":"1"},` +
		`{"start":"1794096000","low":"2990","high":"3070","open":"3000","close":"3050.12","volume":"1"},` +
		`{"start":"1794009600","low":"2950","high":"3010","open":"2960","close":"3001.5","volume":"1"}]}`
	refused = `{"error":"INVALID_ARGUMENT","error_details":"valid product_id is required",` +
		`"message":"valid product_id is required"}`
)

func TestCodes(t *testing.T) {
	t.Parallel()

	src := coinbase.New(http.DefaultClient, "", at("2026-12-01T00:00:00Z"))

	tests := []struct {
		name string
		in   feed.Instrument
		want bool
	}{
		{"crypto BRL", feed.Instrument{Code: "BTC", Type: "crypto", QuoteCurrency: "BRL"}, true},
		{"crypto USD", feed.Instrument{Code: "ETH", Type: "crypto", QuoteCurrency: "USD"}, true},
		{"crypto without quote", feed.Instrument{Code: "ETH", Type: "crypto"}, false},
		{"stock", feed.Instrument{Code: "PETR4", Type: "stock", QuoteCurrency: "BRL"}, false},
		{"currency", feed.Instrument{Code: "USD", Type: "currency"}, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := src.Codes([]feed.Instrument{tc.in})
			if (len(got) == 1) != tc.want {
				t.Fatalf("codes = %v, want quoted %v", got, tc.want)
			}
		})
	}
}

func TestFetch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		codes    []money.Currency
		from, to string
		fail     bool
		requests []string
		quotes   []string
		scope    string
	}{
		{
			"refused product and fixture",
			[]money.Currency{"BTC", "ETH"},
			"2026-11-01",
			"2026-11-09",
			false,
			[]string{
				"/products/BTC-BRL/candles?granularity=ONE_DAY&start=1793491200&end=1794182400",
				"/products/ETH-USD/candles?granularity=ONE_DAY&start=1793491200&end=1794182400",
			},
			[]string{
				"ETH USD 2026-11-07 3001.5",
				"ETH USD 2026-11-08 3050.12",
				"ETH USD 2026-11-09 3088.45",
			},
			"",
		},
		{
			"two windows",
			[]money.Currency{"ETH"},
			"2025-11-09",
			"2026-11-09",
			false,
			[]string{
				"/products/ETH-USD/candles?granularity=ONE_DAY&start=1762646400&end=1788480000",
				"/products/ETH-USD/candles?granularity=ONE_DAY&start=1788566400&end=1794182400",
			},
			[]string{
				"ETH USD 2026-11-07 3001.5",
				"ETH USD 2026-11-08 3050.12",
				"ETH USD 2026-11-09 3088.45",
				"ETH USD 2026-11-07 3001.5",
				"ETH USD 2026-11-08 3050.12",
				"ETH USD 2026-11-09 3088.45",
			},
			"",
		},
		{
			"server error",
			[]money.Currency{"ETH"},
			"2026-11-01",
			"2026-11-09",
			true,
			[]string{
				"/products/ETH-USD/candles?granularity=ONE_DAY&start=1793491200&end=1794182400",
			},
			nil,
			"instrument ETH",
		},
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

					switch {
					case tc.fail:
						w.WriteHeader(http.StatusInternalServerError)
					case r.URL.Path == "/products/BTC-BRL/candles":
						w.WriteHeader(http.StatusBadRequest)
						_, _ = w.Write([]byte(refused))
					default:
						_, _ = w.Write([]byte(ethCandles))
					}
				}),
			)
			t.Cleanup(srv.Close)

			src := coinbase.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z"))
			src.Codes([]feed.Instrument{
				{Code: "BTC", Type: "crypto", QuoteCurrency: "BRL"},
				{Code: "ETH", Type: "crypto", QuoteCurrency: "USD"},
			})

			got, err := src.Fetch(t.Context(), tc.codes, day(tc.from), day(tc.to))

			var scope *feed.ScopeError
			if tc.scope == "" && err != nil {
				t.Fatal(err)
			}

			if tc.scope != "" &&
				(!errors.As(err, &scope) || scope.Key+" "+scope.Value != tc.scope) {
				t.Fatalf("err = %v, want scope %s", err, tc.scope)
			}

			var lines []string
			for _, q := range got {
				lines = append(lines, fmt.Sprintf("%s %s %s %s",
					q.Instrument, q.Quote, q.Date.Format(time.DateOnly), q.Value.String()))
			}

			if !slices.Equal(lines, tc.quotes) {
				t.Fatalf("quotes = %v, want %v", lines, tc.quotes)
			}

			if !slices.Equal(requests, tc.requests) {
				t.Fatalf("requests = %v, want %v", requests, tc.requests)
			}
		})
	}
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

const products = `{"products":[
{"product_id":"BTC-USD","base_currency_id":"BTC","quote_currency_id":"USD","base_name":"Bitcoin","is_disabled":false},
{"product_id":"BTC-USDC","base_currency_id":"BTC","quote_currency_id":"USDC","base_name":"Bitcoin","is_disabled":false},
{"product_id":"ETH-EUR","base_currency_id":"ETH","quote_currency_id":"EUR","base_name":"Ethereum","is_disabled":false},
{"product_id":"OLD-USD","base_currency_id":"OLD","quote_currency_id":"USD","base_name":"Old Bitcoin","is_disabled":true}
],"num_products":4}`

func TestSearch(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		requests []string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()

		requests = append(requests, r.URL.Path+"?"+r.URL.RawQuery)
		mu.Unlock()

		_, _ = w.Write([]byte(products))
	}))
	t.Cleanup(srv.Close)

	src := coinbase.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z"))

	got, err := src.Search(t.Context(), "bit", 20)
	if err != nil {
		t.Fatal(err)
	}

	want := []feed.Listing{
		{Code: "BTC", Name: "Bitcoin", Type: "crypto", QuoteCurrency: "USD", Symbol: "BTC-USD"},
		{Code: "BTC", Name: "Bitcoin", Type: "crypto", QuoteCurrency: "USDC", Symbol: "BTC-USDC"},
	}
	if !slices.Equal(got, want) {
		t.Fatalf("bit = %+v, want %+v", got, want)
	}

	got, err = src.Search(t.Context(), "eth", 20)
	if err != nil {
		t.Fatal(err)
	}

	want = []feed.Listing{
		{Code: "ETH", Name: "Ethereum", Type: "crypto", QuoteCurrency: "EUR", Symbol: "ETH-EUR"},
	}
	if !slices.Equal(got, want) {
		t.Fatalf("eth = %+v, want %+v", got, want)
	}

	if wantReq := []string{"/products?product_type=SPOT"}; !slices.Equal(requests, wantReq) {
		t.Fatalf("requests = %v, want %v", requests, wantReq)
	}
}

func TestSearchFailsOnAServerError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	if _, err := coinbase.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z")).
		Search(t.Context(), "bit", 20); err == nil {
		t.Fatal("Search succeeded on a 500")
	}
}

func at(s string) func() time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}

	return func() time.Time { return t }
}
