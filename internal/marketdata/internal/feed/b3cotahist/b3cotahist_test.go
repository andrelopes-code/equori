package b3cotahist_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/b3cotahist"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestCOTAHIST(t *testing.T) {
	t.Parallel()
	file := cotahistZIP(t, "20261029",
		cotahistRecord("20261029", "MXRF11", "010", 936),
		cotahistRecord("20261029", "PETR4", "010", 3842),
		cotahistRecord("20261029", "PETR4F", "020", 3840),
		cotahistRecord("20261029", "VALE3", "010", 6100),
	)
	var path string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		switch r.URL.Path {
		case "/COTAHIST_D29102026.ZIP":
			_, _ = w.Write(file)
		case "/COTAHIST_D30102026.ZIP":
			_, _ = w.Write(file[:len(file)/2])
		case "/COTAHIST_D31102026.ZIP":
			http.Error(w, "busy", http.StatusInternalServerError)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	src := b3cotahist.New(srv.Client(), srv.URL)

	got, err := src.FetchDay(t.Context(), day("2026-10-29"), []string{"MXRF11", "PETR4", "PETR4F"})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/COTAHIST_D29102026.ZIP" || len(got) != 2 {
		t.Fatalf("path %s, quotes %+v", path, got)
	}
	if q := got[0]; q.Instrument != "MXRF11" || q.Quote != "BRL" || !q.Date.Equal(day("2026-10-29")) || q.Value.String() != "9.36" {
		t.Fatalf("MXRF11 = %+v", q)
	}
	if q := got[1]; q.Instrument != "PETR4" || q.Value.String() != "38.42" {
		t.Fatalf("PETR4 = %+v", q)
	}

	if _, err := src.FetchDay(t.Context(), day("2026-11-02"), []string{"MXRF11"}); !errors.Is(err, feed.ErrNoData) {
		t.Fatalf("404 err = %v", err)
	}
	for _, d := range []string{"2026-10-30", "2026-10-31"} {
		if _, err := src.FetchDay(t.Context(), day(d), []string{"MXRF11"}); err == nil || errors.Is(err, feed.ErrNoData) {
			t.Fatalf("%s err = %v", d, err)
		}
	}
}

// The file of 2026-10-22 carried a company name in UTF-8 ("FROTA OCEÂNI"), a record of 246 bytes.
func TestCOTAHISTReadsNamesOutsideASCII(t *testing.T) {
	t.Parallel()
	named := func(ticker, name string, close int64) string {
		return strings.Replace(cotahistRecord("20261022", ticker, "010", close), "NAME        ", name, 1)
	}
	latin1 := strings.Replace(named("FRTA3", "OCEANICA    ", 512), "OCEANICA", "OCE\xc2NICA", 1)
	file := cotahistZIP(t, "20261022",
		named("FRTA3", fmt.Sprintf("%-12s", "OCEÂNICA"), 511),
		latin1,
		cotahistRecord("20261022", "PETR4", "010", 3842),
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(file) }))
	t.Cleanup(srv.Close)
	got, err := b3cotahist.New(srv.Client(), srv.URL).FetchDay(t.Context(), day("2026-10-22"), []string{"FRTA3", "PETR4"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 || got[0].Value.String() != "5.11" || got[1].Value.String() != "5.12" || got[2].Value.String() != "38.42" {
		t.Fatalf("quotes %+v", got)
	}
}

func TestCOTAHISTRejectsMalformedFiles(t *testing.T) {
	t.Parallel()
	short := cotahistRecord("20261029", "MXRF11", "010", 936)[:200]
	tests := map[string][]byte{
		"short line": cotahistZIP(t, "20261029", short),
		"other date": cotahistZIP(t, "20261029", cotahistRecord("20261028", "MXRF11", "010", 936)),
		"bad price":  cotahistZIP(t, "20261029", cotahistRecord("20261029", "MXRF11", "010", 936)[:110]+"X"+cotahistRecord("20261029", "MXRF11", "010", 936)[111:]),
		"zero price": cotahistZIP(t, "20261029", cotahistRecord("20261029", "MXRF11", "010", 0)),
	}
	for name, file := range tests {
		t.Run(name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(file) }))
			t.Cleanup(srv.Close)
			got, err := b3cotahist.New(srv.Client(), srv.URL).FetchDay(t.Context(), day("2026-10-29"), []string{"MXRF11"})
			if err == nil || errors.Is(err, feed.ErrNoData) || got != nil {
				t.Fatalf("got %+v, %v", got, err)
			}
		})
	}
}

func TestFetchRangeSkipsWeekendsAndKeepsEarlierDays(t *testing.T) {
	t.Parallel()
	var paths []string
	file := cotahistZIP(t, "20261029", cotahistRecord("20261029", "MXRF11", "010", 936))
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if r.URL.Path == "/COTAHIST_D29102026.ZIP" {
			_, _ = w.Write(file)
			return
		}
		http.Error(w, "busy", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	got, err := b3cotahist.New(srv.Client(), srv.URL).Fetch(t.Context(), []money.Currency{"MXRF11"}, day("2026-10-29"), day("2026-11-03"))
	var scope *feed.ScopeError
	if !errors.As(err, &scope) || scope.Key != "day" || scope.Value != "2026-10-30" {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 1 || got[0].Instrument != "MXRF11" || len(paths) != 2 {
		t.Fatalf("quotes %+v, paths %v", got, paths)
	}
}

func TestCodes(t *testing.T) {
	t.Parallel()
	ins := []feed.Instrument{
		{Code: "MXRF11", Type: "reit", Exchange: "BVMF", QuoteCurrency: "BRL"},
		{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
		{Code: "USD", Type: "currency"},
	}
	got := b3cotahist.Source{}.Codes(ins)
	if len(got) != 1 || got[0] != "MXRF11" {
		t.Fatalf("codes = %v", got)
	}
}
