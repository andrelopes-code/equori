package brfocus_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/expectation/brfocus"
)

// Rows of the Olinda response of 2026-10-27: the latest survey date wins, the earlier one is
// ignored.
const page = `{"value":[
{"Data":"2026-10-23","DataReferencia":"2027","Mediana":11.75},
{"Data":"2026-10-23","DataReferencia":"2026","Mediana":13.25},
{"Data":"2026-10-22","DataReferencia":"2026","Mediana":13.5}]}`

func TestFetch(t *testing.T) {
	t.Parallel()
	var query, raw string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query, raw = r.URL.Query().Get("$filter"), r.URL.RawQuery
		if r.URL.Path != "/ExpectativasMercadoAnuais" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(page))
	}))
	t.Cleanup(srv.Close)
	got, err := brfocus.New(srv.Client(), srv.URL).Fetch(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	// Olinda answers 400 to a space written as "+".
	if query != "Indicador eq 'Selic' and baseCalculo eq 0" || strings.Contains(raw, "+") {
		t.Fatalf("filter %q, query %s", query, raw)
	}
	if got.Date.Format("2006-01-02") != "2026-10-23" || len(got.Points) != 2 {
		t.Fatalf("survey %+v", got)
	}
	// 13.25 − 0.10 = 13.15% a year; 11.75 − 0.10 = 11.65%.
	if p := got.Points[0]; p.Date.Format("2006-01-02") != "2026-12-31" || p.Rate != "0.131500000000" {
		t.Fatalf("2026 = %+v", p)
	}
	if p := got.Points[1]; p.Date.Format("2006-01-02") != "2027-12-31" || p.Rate != "0.116500000000" {
		t.Fatalf("2027 = %+v", p)
	}
}

func TestFetchEmpty(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"value":[]}`))
	}))
	t.Cleanup(srv.Close)
	if _, err := brfocus.New(srv.Client(), srv.URL).Fetch(t.Context()); err == nil {
		t.Fatal("no error")
	}
}
