package cvmfunds_test

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/cvmfunds"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	header2020 = "CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST\n"
	header2021 = "TP_FUNDO;CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST\n"
)

func TestCodes(t *testing.T) {
	t.Parallel()

	src := cvmfunds.New(http.DefaultClient, "")

	tests := []struct {
		name string
		in   feed.Instrument
		want bool
	}{
		{"fund", feed.Instrument{Code: "00017024000153", Type: "fund", QuoteCurrency: "BRL"}, true},
		{"13 characters", feed.Instrument{Code: "0001702400015", Type: "fund", QuoteCurrency: "BRL"}, false},
		{"exchange", feed.Instrument{Code: "00017024000153", Type: "fund", Exchange: "BVMF", QuoteCurrency: "BRL"}, false},
		{"quote", feed.Instrument{Code: "00017024000153", Type: "fund", QuoteCurrency: "USD"}, false},
		{"type", feed.Instrument{Code: "00017024000153", Type: "stock", QuoteCurrency: "BRL"}, false},
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

	files := map[string][]byte{
		"/HIST/inf_diario_fi_2020.zip": zipOf(t, map[string]string{
			"inf_diario_fi_202011.csv": header2020 +
				"00.017.024/0001-53;2020-11-30;1.00;40.100000000000;1.00;0.00;0.00;1\n",
			"inf_diario_fi_202012.csv": header2021 +
				"FI;00.017.024/0001-53;2020-12-30;1.00;40.200000000000;1.00;0.00;0.00;1\n",
		}),
		"/inf_diario_fi_202101.zip": zipOf(t, map[string]string{
			"inf_diario_fi_202101.csv": header2021 +
				"FI;00.017.024/0001-53;2021-01-04;1.00;40.300000000000;1.00;0.00;0.00;1\n" +
				"FI;00.888.897/0001-31;2021-01-04;1.00;70.000000000000;1.00;0.00;0.00;1\n" +
				"FI;00.017.024/0001-53;2021-01-06;1.00;40.400000000000;1.00;0.00;0.00;1\n",
		}),
	}

	tests := []struct {
		name     string
		from, to string
		requests []string
		quotes   []string
		scope    string
	}{
		{
			"year and month", "2020-12-01", "2021-01-05",
			[]string{"/HIST/inf_diario_fi_2020.zip", "/inf_diario_fi_202101.zip"},
			[]string{"2020-12-30 40.200000000000", "2021-01-04 40.300000000000"}, "",
		},
		{"missing month", "2021-02-01", "2021-02-05", []string{"/inf_diario_fi_202102.zip"}, nil, ""},
		{"failing month", "2021-03-01", "2021-03-05", []string{"/inf_diario_fi_202103.zip"}, nil, "month 2021-03"},
		{"before 2000", "1999-12-01", "2000-01-03", []string{"/HIST/inf_diario_fi_2000.zip"}, nil, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var (
				mu       sync.Mutex
				requests []string
			)

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()

				requests = append(requests, r.URL.Path)
				mu.Unlock()

				if r.URL.Path == "/inf_diario_fi_202103.zip" {
					w.WriteHeader(http.StatusInternalServerError)

					return
				}

				body, ok := files[r.URL.Path]
				if !ok {
					http.NotFound(w, r)

					return
				}

				_, _ = w.Write(body)
			}))
			t.Cleanup(srv.Close)

			got, err := cvmfunds.New(srv.Client(), srv.URL).
				Fetch(t.Context(), []money.Currency{"00017024000153"}, day(tc.from), day(tc.to))

			var scope *feed.ScopeError
			if tc.scope == "" && err != nil {
				t.Fatal(err)
			}

			if tc.scope != "" && (!errors.As(err, &scope) || scope.Key+" "+scope.Value != tc.scope) {
				t.Fatalf("err = %v, want scope %s", err, tc.scope)
			}

			var lines []string

			for _, q := range got {
				if q.Instrument != "00017024000153" || q.Quote != "BRL" {
					t.Fatalf("quote = %+v", q)
				}

				lines = append(lines, fmt.Sprintf("%s %s", q.Date.Format(time.DateOnly), q.Value.String()))
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

func zipOf(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	names := make([]string, 0, len(entries))
	for name := range entries {
		names = append(names, name)
	}

	slices.Sort(names)

	for _, name := range names {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := w.Write([]byte(entries[name])); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return buf.Bytes()
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}
