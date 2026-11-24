package yahoochart_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/yahoochart"
)

// A266 SA2: the splits of each security, on the local date of the exchange; a currency is not asked.
func TestSplits(t *testing.T) {
	t.Parallel()

	var asked []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.Path+"?"+r.URL.Query().Get("events"))

		if strings.HasPrefix(r.URL.Path, "/SBSP3") {
			_, _ = fmt.Fprint(
				w,
				`{"chart":{"result":[{"meta":{"exchangeTimezoneName":"America/Sao_Paulo"},
				"events":{"splits":{
					"1180962000":{"date":1180962000,"numerator":1,"denominator":125},
					"1766754000":{"date":1766754000,"numerator":1.029647,"denominator":1},
					"9":{"date":9,"numerator":0,"denominator":1}}},
				"indicators":{"quote":[{}]}}]}}`,
			)

			return
		}

		_, _ = fmt.Fprint(
			w,
			`{"chart":{"result":[{"meta":{"exchangeTimezoneName":"America/Sao_Paulo"},
			"indicators":{"quote":[{}]}}]}}`,
		)
	}))
	t.Cleanup(srv.Close)

	src := yahoochart.New(srv.Client(), srv.URL, at("2026-12-01T00:00:00Z"))

	got, err := src.Splits(t.Context(), []feed.Instrument{
		{Code: "SBSP3", Type: "stock", Exchange: "BVMF", QuoteCurrency: "BRL"},
		{Code: "BOVA11", Type: "etf", Exchange: "BVMF", QuoteCurrency: "BRL"},
		{Code: "EUR", Type: "currency"},
	})
	if err != nil {
		t.Fatal(err)
	}

	lines := make([]string, len(got))
	for i, s := range got {
		lines[i] = fmt.Sprintf("%s %s %s", s.Instrument, s.Date.Format(time.DateOnly), s.Ratio)
	}

	slices.Sort(lines)

	want := []string{"SBSP3 2007-06-04 1/125", "SBSP3 2025-12-26 1029647/1000000"}
	if !slices.Equal(lines, want) {
		t.Errorf("splits = %v, want %v", lines, want)
	}

	if !slices.Equal(asked, []string{"/SBSP3.SA?split", "/BOVA11.SA?split"}) {
		t.Errorf("asked = %v", asked)
	}
}
