package ecb_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/ecb"
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

	got, err := src.Fetch(t.Context(), []money.Currency{"USD"}, day("2026-10-20"), day("2026-10-20"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Instrument != "EUR" || got[0].Quote != "USD" || !got[0].Date.Equal(day("2026-10-20")) || got[0].Value.String() != "1.0832" {
		t.Fatalf("quotes = %+v", got)
	}

	got, err = src.Fetch(t.Context(), []money.Currency{"GBP", "USD"}, day("2026-10-19"), day("2026-10-20"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 4 {
		t.Fatalf("quotes = %+v", got)
	}

	missing := ecb.New(srv.Client(), srv.URL+"/missing.xml")
	if _, err := missing.Fetch(t.Context(), []money.Currency{"USD"}, day("2026-10-19"), day("2026-10-20")); !errors.Is(err, feed.ErrNoData) {
		t.Fatalf("404 error = %v", err)
	}
}
