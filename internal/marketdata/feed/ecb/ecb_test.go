package ecb_test

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/ecb"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

func TestECB(t *testing.T) {
	t.Parallel()

	body, err := os.ReadFile("testdata/eurofxref-hist-90d.xml")
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/missing.xml" {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	src := ecb.New(srv.Client(), srv.URL+"/eurofxref-hist-90d.xml")

	ins := []feed.Instrument{
		{Code: "EUR", Type: "currency"}, {Code: "USD", Type: "currency"},
		{Code: "GBP", Type: "currency"}, {Code: "BTC", Type: "crypto"},
	}
	if got := src.Codes(ins); !slices.Equal(got, []money.Currency{"GBP", "USD"}) {
		t.Fatalf("codes = %v", got)
	}

	got, err := src.Fetch(
		t.Context(),
		[]money.Currency{"USD"},
		day("2026-10-20"),
		day("2026-10-20"),
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].Instrument != "EUR" || got[0].Quote != "USD" ||
		!got[0].Date.Equal(day("2026-10-20")) ||
		got[0].Value.String() != "1.0832" {
		t.Fatalf("quotes = %+v", got)
	}

	got, err = src.Fetch(
		t.Context(),
		[]money.Currency{"GBP", "USD"},
		day("2026-10-19"),
		day("2026-10-20"),
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 4 {
		t.Fatalf("quotes = %+v", got)
	}

	missing := ecb.New(srv.Client(), srv.URL+"/missing.xml")
	if _, err := missing.Fetch(
		t.Context(),
		[]money.Currency{"USD"},
		day("2026-10-19"),
		day("2026-10-20"),
	); !errors.Is(
		err,
		feed.ErrNoData,
	) {
		t.Fatalf("404 error = %v", err)
	}
}

func TestECBHistory(t *testing.T) {
	t.Parallel()

	xmlBody, err := os.ReadFile("testdata/eurofxref-hist-90d.xml")
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	f, err := zw.Create("eurofxref-hist.csv")
	if err != nil {
		t.Fatal(err)
	}

	_, _ = f.Write([]byte("Date,USD,JPY,BRL,\n" +
		"2026-10-20,1.0832,160.11,5.9001,\n" +
		"2026-10-19,1.0840,160.50,N/A,\n" +
		"2010-01-04,1.4389,133.92,2.5110,\n"))

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	var paths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if r.URL.Path == "/eurofxref-hist.zip" {
			_, _ = w.Write(buf.Bytes())
			return
		}

		_, _ = w.Write(xmlBody)
	}))
	t.Cleanup(srv.Close)

	got, err := ecb.New(srv.Client(), srv.URL+"/eurofxref-hist-90d.xml").
		Fetch(t.Context(), []money.Currency{"BRL", "USD"}, day("2010-01-01"), day("2026-10-20"))
	if err != nil {
		t.Fatal(err)
	}

	var gotSet []string
	for _, q := range got {
		if q.Instrument != "EUR" {
			t.Fatalf("instrument = %s", q.Instrument)
		}

		gotSet = append(
			gotSet,
			fmt.Sprintf("%s %s %s", q.Quote, q.Date.Format(time.DateOnly), q.Value.String()),
		)
	}

	want := []string{
		"BRL 2026-10-20 5.9001", "USD 2026-10-20 1.0832", "USD 2026-10-19 1.0840",
		"BRL 2010-01-04 2.5110", "USD 2010-01-04 1.4389",
	}

	slices.Sort(gotSet)
	slices.Sort(want)

	if !slices.Equal(gotSet, want) {
		t.Fatalf("quotes = %v", gotSet)
	}

	if !slices.Equal(paths, []string{"/eurofxref-hist-90d.xml", "/eurofxref-hist.zip"}) {
		t.Fatalf("requests = %v", paths)
	}
}

func TestECBConditional(t *testing.T) {
	t.Parallel()

	const lastModified = "Mon, 09 Nov 2026 14:56:21 GMT"

	body, err := os.ReadFile("testdata/eurofxref-hist-90d.xml")
	if err != nil {
		t.Fatal(err)
	}

	var sent []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		since := r.Header.Get("If-Modified-Since")
		sent = append(sent, since)

		if since == lastModified {
			w.WriteHeader(http.StatusNotModified)

			return
		}

		w.Header().Set("Last-Modified", lastModified)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	src := ecb.New(srv.Client(), srv.URL+"/eurofxref-hist-90d.xml")

	calls := []struct {
		codes      []money.Currency
		quotes     int
		wantHeader string
	}{
		{[]money.Currency{"USD"}, 2, ""},
		{[]money.Currency{"USD"}, 0, lastModified},
		{[]money.Currency{"BRL", "USD"}, 2, ""},
	}
	for i, c := range calls {
		got, err := src.Fetch(t.Context(), c.codes, day("2026-10-19"), day("2026-10-20"))
		if err != nil {
			t.Fatalf("call %d: %v", i+1, err)
		}

		if len(got) != c.quotes {
			t.Fatalf("call %d: %d quotes, want %d", i+1, len(got), c.quotes)
		}

		if sent[i] != c.wantHeader {
			t.Fatalf("call %d: If-Modified-Since %q, want %q", i+1, sent[i], c.wantHeader)
		}
	}
}
