package yahoochart_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/yahoochart"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	localDate = `{"chart":{"result":[{"meta":{"currency":"USD","exchangeTimezoneName":"America/New_York"},` +
		`"timestamp":[1793845800],"indicators":{"quote":[{"close":[1.5]}]}}],"error":null}}`
	// A flat bar with volume 0 is the last close that Yahoo repeats on a day without a trade.
	noTrade = `{"chart":{"result":[{"meta":{"currency":"USD","exchangeTimezoneName":"America/New_York"},` +
		`"timestamp":[1793802600,1793889000,1793975400],"indicators":{"quote":[{` +
		`"open":[10,10,10],"high":[10,10,11],"low":[10,10,9],"close":[10,10,10.5],` +
		`"volume":[5,0,0]}]}}],"error":null}}`
	// Yahoo answers 400 for a range without bars, as for an ETF listed after the start date.
	noBars = `{"chart":{"result":null,"error":{"code":"Bad Request",` +
		`"description":"Data doesn't exist for startDate = 1163462400, endDate = 1792972800"}}}`
	badRequest = `{"chart":{"result":null,"error":{"code":"Bad Request",` +
		`"description":"Invalid input - interval=1x is not supported"}}}`
	notFound = `{"chart":{"result":null,"error":{"code":"Not Found",` +
		`"description":"No data found, symbol may be delisted"}}}`
)

func TestSymbol(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		in      feed.Instrument
		symbols map[string]string
		want    string
	}{
		{
			"US stock",
			feed.Instrument{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
			nil,
			"AAPL",
		},
		{
			"dot becomes dash",
			feed.Instrument{Code: "BRK.B", Type: "stock", Exchange: "XNYS", QuoteCurrency: "USD"},
			nil,
			"BRK-B",
		},
		{
			"B3 stock",
			feed.Instrument{Code: "PETR4", Type: "stock", Exchange: "BVMF", QuoteCurrency: "BRL"},
			nil,
			"PETR4.SA",
		},
		{
			"Xetra ETF",
			feed.Instrument{Code: "VWCE", Type: "etf", Exchange: "XETR", QuoteCurrency: "EUR"},
			nil,
			"VWCE.DE",
		},
		{"currency", feed.Instrument{Code: "EUR", Type: "currency"}, nil, "EURUSD=X"},
		{"USD", feed.Instrument{Code: "USD", Type: "currency"}, nil, ""},
		{
			"crypto",
			feed.Instrument{Code: "BTC", Type: "crypto", QuoteCurrency: "USD"},
			nil,
			"BTC-USD",
		},
		{
			"MIC outside the table",
			feed.Instrument{Code: "FPH", Type: "stock", Exchange: "XNZE", QuoteCurrency: "NZD"},
			nil,
			"",
		},
		{
			"override",
			feed.Instrument{Code: "FPH", Type: "stock", Exchange: "XNZE", QuoteCurrency: "NZD"},
			map[string]string{"yahoo_chart": "FPH.NZ"},
			"FPH.NZ",
		},
		{
			"override of another source",
			feed.Instrument{Code: "FPH", Type: "stock", Exchange: "XNZE", QuoteCurrency: "NZD"},
			map[string]string{"other": "FPH.NZ"},
			"",
		},
		{
			"no exchange",
			feed.Instrument{Code: "CDB1", Type: "fixed_income", QuoteCurrency: "BRL"},
			nil,
			"",
		},
	}

	src := yahoochart.New(http.DefaultClient, "", at("2026-12-01T00:00:00Z"))

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tc.in.Symbols = tc.symbols

			got, ok := src.Symbol(tc.in)
			if got != tc.want || ok != (tc.want != "") {
				t.Fatalf("symbol = %q, %v, want %q", got, ok, tc.want)
			}
		})
	}
}

func TestCodes(t *testing.T) {
	t.Parallel()

	src := yahoochart.New(http.DefaultClient, "", at("2026-12-01T00:00:00Z"))

	got := src.Codes([]feed.Instrument{
		{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
		{Code: "EUR", Type: "currency"},
		{Code: "BRL", Type: "currency"},
		{Code: "USD", Type: "currency"},
		{Code: "PETR4", Type: "stock", Exchange: "BVMF", QuoteCurrency: "BRL"},
	})

	if want := []money.Currency{"AAPL", "BRL", "PETR4"}; !slices.Equal(got, want) {
		t.Fatalf("codes = %v, want %v", got, want)
	}
}

func TestFetch(t *testing.T) {
	t.Parallel()

	aapl, err := os.ReadFile("testdata/aapl.json")
	if err != nil {
		t.Fatal(err)
	}

	gbp := strings.Replace(string(aapl), `"currency":"USD"`, `"currency":"GBp"`, 1)

	tests := []struct {
		name   string
		status int
		body   string
		quotes []string
		scope  string
	}{
		{
			"fixture",
			http.StatusOK,
			string(aapl),
			[]string{
				"AAPL USD 2026-11-04 349.51",
				"AAPL USD 2026-11-05 344.17",
				"AAPL USD 2026-11-06 342.37",
			},
			"",
		},
		{"local date", http.StatusOK, localDate, []string{"AAPL USD 2026-11-04 1.5"}, ""},
		{
			"day without a trade",
			http.StatusOK,
			noTrade,
			[]string{"AAPL USD 2026-11-04 10", "AAPL USD 2026-11-06 10.5"},
			"",
		},
		{"range without bars", http.StatusBadRequest, noBars, nil, ""},
		{"invalid request", http.StatusBadRequest, badRequest, nil, "instrument AAPL"},
		{"pence", http.StatusOK, gbp, nil, "instrument AAPL"},
		{"unknown symbol", http.StatusNotFound, notFound, nil, ""},
		{"server error", http.StatusInternalServerError, "", nil, "instrument AAPL"},
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

			src := yahoochart.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z"))
			src.Codes(
				[]feed.Instrument{
					{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
				},
			)

			got, err := src.Fetch(
				t.Context(),
				[]money.Currency{"AAPL"},
				day("2026-11-01"),
				day("2026-11-09"),
			)

			var scope *feed.ScopeError
			if tc.scope == "" && err != nil {
				t.Fatal(err)
			}

			if tc.scope != "" &&
				(!errors.As(err, &scope) || scope.Key+" "+scope.Value != tc.scope) {
				t.Fatalf("err = %v, want scope %s", err, tc.scope)
			}

			if tc.name == "pence" && !strings.HasSuffix(err.Error(), "quoted in GBp, want USD") {
				t.Fatalf("err = %v", err)
			}

			if got := lines(got); !slices.Equal(got, tc.quotes) {
				t.Fatalf("quotes = %v, want %v", got, tc.quotes)
			}

			want := []string{"/AAPL?period1=1793491200&period2=1794268800&interval=1d"}
			if !slices.Equal(requests, want) {
				t.Fatalf("requests = %v, want %v", requests, want)
			}
		})
	}
}

func TestFetchRateLimited(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		requests []string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()

		requests = append(requests, r.URL.Path)
		mu.Unlock()

		w.WriteHeader(http.StatusTooManyRequests)
	}))
	t.Cleanup(srv.Close)

	src := yahoochart.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z"))
	src.Codes([]feed.Instrument{
		{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
		{Code: "PETR4", Type: "stock", Exchange: "BVMF", QuoteCurrency: "BRL"},
	})

	_, err := src.Fetch(
		t.Context(),
		[]money.Currency{"AAPL", "PETR4"},
		day("2026-11-01"),
		day("2026-11-09"),
	)

	var (
		status *feed.StatusError
		scope  *feed.ScopeError
	)

	if !errors.As(err, &status) || status.Code != http.StatusTooManyRequests ||
		errors.As(err, &scope) {
		t.Fatalf("err = %v, want a bare status 429", err)
	}

	if !slices.Equal(requests, []string{"/AAPL"}) {
		t.Fatalf("requests = %v, want [/AAPL]", requests)
	}
}

func TestSearch(t *testing.T) {
	t.Parallel()

	body, err := os.ReadFile("testdata/search.json")
	if err != nil {
		t.Fatal(err)
	}

	status := http.StatusOK

	var query string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/yahoo/v1/finance/search" {
			t.Errorf("path = %q, want /yahoo/v1/finance/search", r.URL.Path)
		}

		query = r.URL.RawQuery

		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}

		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	src := yahoochart.New(
		srv.Client(),
		srv.URL+"/yahoo/v8/finance/chart",
		at("2026-12-01T00:00:00Z"),
	)

	got, err := src.Search(t.Context(), "vw ce", 20)
	if err != nil {
		t.Fatal(err)
	}

	want := []feed.Listing{
		{
			Code: "VWCE", Name: "Vanguard FTSE All-World UCITS ETF USD Accumulation", Type: "etf",
			Exchange: "XETR", QuoteCurrency: "EUR", Symbol: "VWCE.DE",
		},
		{
			Code: "AAPL", Name: "Apple Inc.", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD",
			Symbol: "AAPL",
		},
		{
			Code: "BRK.B", Name: "Berkshire Hathaway Inc. New", Type: "stock", Exchange: "XNYS",
			QuoteCurrency: "USD", Symbol: "BRK-B",
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("search = %+v, want %+v", got, want)
	}

	if query != "q=vw+ce&quotesCount=20&newsCount=0" {
		t.Fatalf("query = %q", query)
	}

	status = http.StatusTooManyRequests

	if _, err := src.Search(t.Context(), "vw", 20); err == nil {
		t.Fatal("429 answer returned no error")
	}
}

func lines(quotes []feed.Quote) []string {
	var out []string
	for _, q := range quotes {
		out = append(
			out,
			fmt.Sprintf(
				"%s %s %s %s",
				q.Instrument,
				q.Quote,
				q.Date.Format(time.DateOnly),
				q.Value.String(),
			),
		)
	}

	return out
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

// Yahoo answers EQUITY for an ETF and a FII of the B3; the name states the type (amendment A226).
func TestSearchTypesTheListingsOfTheB3ByName(t *testing.T) {
	t.Parallel()

	body := `{"quotes":[
{"exchange":"SAO","quoteType":"EQUITY","symbol":"BOVA11.SA","longname":"ISHARES IBOVESPA CLASSE DE ÍNDICE - RESPONSABILIDADE LIMITADA"},
{"exchange":"SAO","quoteType":"EQUITY","symbol":"MXRF11.SA","longname":"Maxi Renda Fundo De Investimento Imobiliaro - FII"},
{"exchange":"SAO","quoteType":"EQUITY","symbol":"PETR4.SA","longname":"Petróleo Brasileiro S.A. - Petrobras"}
]}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	src := yahoochart.New(
		srv.Client(),
		srv.URL+"/yahoo/v8/finance/chart",
		at("2026-12-01T00:00:00Z"),
	)

	got, err := src.Search(t.Context(), "11", 20)
	if err != nil {
		t.Fatal(err)
	}

	types := make([]string, len(got))
	for i, l := range got {
		types[i] = string(l.Code) + " " + l.Type
	}

	if want := []string{"BOVA11 etf", "MXRF11 reit", "PETR4 stock"}; !slices.Equal(types, want) {
		t.Fatalf("types = %v, want %v", types, want)
	}
}

func at(s string) func() time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}

	return func() time.Time { return t }
}
