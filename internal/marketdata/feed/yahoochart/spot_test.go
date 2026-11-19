package yahoochart_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/yahoochart"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	spotRequest     = "/AAPL?range=1d&interval=1d"
	spotNow         = "2026-11-12T15:13:00Z"
	spotQuoteOpen   = "AAPL USD 154.122 at 2026-11-12T15:12:00Z date 2026-11-12 open"
	spotQuoteClosed = "AAPL USD 156.14 at 2026-11-12T21:00:01Z date 2026-11-12 closed"
)

var spotAAPL = feed.Instrument{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"}

func TestCurrent(t *testing.T) {
	t.Parallel()

	var (
		open   = spotBody("USD", "America/New_York", "154.122", 1794496320, 1794493800, 1794517200)
		closed = spotBody("USD", "America/New_York", "156.14", 1794517201, 1794493800, 1794517200)
	)

	tests := []struct {
		name     string
		ins      []feed.Instrument
		now      string
		status   int
		body     string
		quotes   []string
		scope    string
		suffix   string
		limited  bool
		requests []string
	}{
		{
			name: "open session", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status: 200, body: open,
			quotes: []string{spotQuoteOpen}, requests: []string{spotRequest},
		},
		{
			name: "closed session", ins: []feed.Instrument{spotAAPL}, now: "2026-11-12T22:00:00Z",
			status: 200, body: closed,
			quotes: []string{spotQuoteClosed}, requests: []string{spotRequest},
		},
		{
			name: "before the open", ins: []feed.Instrument{spotAAPL}, now: "2026-11-12T14:00:00Z",
			status: 200, body: closed,
			quotes: []string{spotQuoteClosed}, requests: []string{spotRequest},
		},
		{
			name:   "currency",
			ins:    []feed.Instrument{{Code: "BRL", Type: "currency"}},
			now:    spotNow,
			status: 200,
			body: spotBody(
				"USD",
				"Europe/London",
				"0.1729",
				1794496320,
				1794441600,
				1794527940,
			),
			quotes:   []string{"BRL USD 0.1729 at 2026-11-12T15:12:00Z date 2026-11-12 open"},
			requests: []string{"/BRLUSD=X?range=1d&interval=1d"},
		},
		{
			name:     "no period",
			ins:      []feed.Instrument{spotAAPL},
			now:      spotNow,
			status:   200,
			body:     spotBodyWithoutPeriod("USD", "America/New_York", "154.122", 1794496320),
			quotes:   []string{strings.Replace(spotQuoteOpen, "open", "closed", 1)},
			requests: []string{spotRequest},
		},
		{
			name: "other currency", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status: 200,
			body:   spotBody("GBp", "Europe/London", "154.122", 1794496320, 1794493800, 1794517200),
			scope:  "AAPL", suffix: "quoted in GBp, want USD", requests: []string{spotRequest},
		},
		{
			name: "unknown symbol", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status: 404, body: `{}`, requests: []string{spotRequest},
		},
		{
			name: "no price", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status:   200,
			body:     spotBody("USD", "America/New_York", "0", 1794496320, 1794493800, 1794517200),
			requests: []string{spotRequest},
		},
		{
			name: "server error", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status: 500, body: `{}`, scope: "AAPL", requests: []string{spotRequest},
		},
		{
			name: "rate limited", ins: []feed.Instrument{spotAAPL}, now: spotNow,
			status: 429, body: `{}`, limited: true, requests: []string{spotRequest},
		},
		{
			name: "no symbol",
			ins: []feed.Instrument{
				{Code: "BRKZ", Type: "stock", Exchange: "XNZE", QuoteCurrency: "USD"},
				{Code: "USD", Type: "currency"},
			},
			now: spotNow, status: 200, body: open,
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

					requests = append(requests, r.RequestURI)
					mu.Unlock()

					w.WriteHeader(tc.status)
					_, _ = w.Write([]byte(tc.body))
				}),
			)
			t.Cleanup(srv.Close)

			src := yahoochart.New(srv.Client(), srv.URL, at(tc.now))

			got, err := src.Current(t.Context(), tc.ins)

			assertSpotError(t, err, tc.scope, tc.suffix, tc.limited)

			if lines := spotLines(got); !slices.Equal(lines, tc.quotes) {
				t.Fatalf("quotes = %v, want %v", lines, tc.quotes)
			}

			if !slices.Equal(requests, tc.requests) {
				t.Fatalf("requests = %v, want %v", requests, tc.requests)
			}
		})
	}
}

func TestCurrentKeepsOrder(t *testing.T) {
	t.Parallel()

	body := spotBody("USD", "America/New_York", "154.122", 1794496320, 1794493800, 1794517200)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	src := yahoochart.New(srv.Client(), srv.URL, at(spotNow))

	var ins []feed.Instrument

	for _, code := range []string{"AAPL", "MSFT", "NVDA"} {
		in := spotAAPL
		in.Code = money.Currency(code)
		ins = append(ins, in)
	}

	got, err := src.Current(t.Context(), ins)
	if err != nil {
		t.Fatal(err)
	}

	var codes []string
	for _, q := range got {
		codes = append(codes, string(q.Instrument))
	}

	if want := []string{"AAPL", "MSFT", "NVDA"}; !slices.Equal(codes, want) {
		t.Fatalf("codes = %v, want %v", codes, want)
	}
}

func spotBody(currency, zone, price string, last, start, end int64) string {
	return fmt.Sprintf(
		`{"chart":{"result":[{"meta":{"currency":"%s","exchangeTimezoneName":"%s",`+
			`"regularMarketPrice":%s,"regularMarketTime":%d,`+
			`"currentTradingPeriod":{"regular":{"start":%d,"end":%d}}},`+
			`"timestamp":[],"indicators":{"quote":[{}]}}]}}`,
		currency, zone, price, last, start, end,
	)
}

func spotBodyWithoutPeriod(currency, zone, price string, last int64) string {
	return fmt.Sprintf(
		`{"chart":{"result":[{"meta":{"currency":"%s","exchangeTimezoneName":"%s",`+
			`"regularMarketPrice":%s,"regularMarketTime":%d},`+
			`"timestamp":[],"indicators":{"quote":[{}]}}]}}`,
		currency, zone, price, last,
	)
}

func spotLines(quotes []feed.SpotQuote) []string {
	var out []string

	for _, q := range quotes {
		state := "closed"
		if q.Open {
			state = "open"
		}

		out = append(out, fmt.Sprintf("%s %s %s at %s date %s %s",
			q.Instrument, q.Quote, q.Value, q.At.Format("2006-01-02T15:04:05Z"),
			q.Date.Format("2006-01-02"), state))
	}

	return out
}

func assertSpotError(t *testing.T, err error, scope, suffix string, limited bool) {
	t.Helper()

	var (
		scoped *feed.ScopeError
		status *feed.StatusError
	)

	isScoped := errors.As(err, &scoped)
	isStatus := errors.As(err, &status)

	switch {
	case limited:
		if !isStatus || status.Code != http.StatusTooManyRequests || isScoped {
			t.Fatalf("error = %v, want a bare 429 StatusError", err)
		}
	case scope != "":
		if !isScoped || scoped.Key != "instrument" || scoped.Value != scope {
			t.Fatalf("error = %v, want scope instrument %s", err, scope)
		}

		if !strings.HasSuffix(err.Error(), suffix) {
			t.Fatalf("error = %q, want suffix %q", err, suffix)
		}
	case err != nil:
		t.Fatalf("error = %v, want none", err)
	}
}
