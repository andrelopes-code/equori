package marketdata_test

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

// IF.data and the B3 answer 5xx to a request that the next attempt answers.
func TestFlakySourcesAreAskedAgain(t *testing.T) {
	t.Parallel()

	day := time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)

	t.Run("br_ifdata", func(t *testing.T) {
		t.Parallel()

		synctest.Test(t, func(t *testing.T) {
			src := marketdata.NewInstitutionSources(nil, flakyClient(`{"value":[{"CodInst":"1"}]}`))[0]

			if _, err := src.Fetch(t.Context(), day, nil); err != nil {
				t.Fatal(err)
			}
		})
	})

	t.Run("b3_consolidated", func(t *testing.T) {
		t.Parallel()

		synctest.Test(t, func(t *testing.T) {
			hc := flakyClient(
				`{"token":"t"}`,
				"Status do Arquivo: Final\nRptDt;TckrSymb;LastPric\n2026-10-26;PETR4;36,50\n",
			)

			srcs, err := marketdata.NewSources([]string{"b3_consolidated"}, nil, hc, time.Now)
			if err != nil {
				t.Fatal(err)
			}

			codes := srcs[0].Codes([]feed.Instrument{
				{Code: "PETR4", Exchange: "BVMF", QuoteCurrency: "BRL"},
			})

			got, err := srcs[0].Fetch(t.Context(), codes, day, day)
			if err != nil || len(got) != 1 {
				t.Fatalf("quotes = %v, error = %v, want one quote", got, err)
			}
		})
	})
}

// flakyClient answers each URL first with 504, then with the next body, the last one repeated.
func flakyClient(bodies ...string) *http.Client {
	return &http.Client{Transport: &flaky{failed: map[string]bool{}, bodies: bodies}}
}

type flaky struct {
	failed map[string]bool
	bodies []string
}

func (f *flaky) RoundTrip(r *http.Request) (*http.Response, error) {
	status, body := http.StatusGatewayTimeout, ""

	if url := r.URL.String(); f.failed[url] {
		status, body = http.StatusOK, f.bodies[0]

		if len(f.bodies) > 1 {
			f.bodies = f.bodies[1:]
		}
	} else {
		f.failed[url] = true
	}

	return &http.Response{
		StatusCode: status,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    r,
	}, nil
}
