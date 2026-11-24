package brb3_test

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/index/brb3"
)

// The form of the answer of the B3 for a year: one row per day of the month, one column per month.
const (
	year2025 = `{"results":[
		{"day":29,"rateValue11":null,"rateValue12":"160.490,32"},
		{"day":30,"rateValue11":null,"rateValue12":"161.125,37"},
		{"day":31,"rateValue11":null,"rateValue12":null}]}`
	year2026 = `{"results":[
		{"day":2,"rateValue1":"160.538,69","rateValue2":"182.793,40"},
		{"day":5,"rateValue1":"161.869,76","rateValue2":null},
		{"day":6,"rateValue1":"163.663,88","rateValue2":null}]}`
	noYear = `{"results":[]}`
)

func at(s string) func() time.Time {
	return func() time.Time {
		v, err := time.Parse(time.RFC3339, s)
		if err != nil {
			panic(err)
		}

		return v
	}
}

func date(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

// server answers the year and the index of the request from answers, and an empty year otherwise.
func server(t *testing.T, name string, answers map[string]string) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := base64.StdEncoding.DecodeString(
			r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:],
		)
		if err != nil {
			t.Errorf("path %s: %v", r.URL.Path, err)
		}

		var q struct{ Index, Language, Year string }
		if err := json.Unmarshal(raw, &q); err != nil || q.Index != name || q.Language != "pt-br" {
			t.Errorf("request = %s", raw)
		}

		answer, ok := answers[q.Year]
		if !ok {
			answer = noYear
		}

		_, _ = w.Write([]byte(answer))
	}))
	t.Cleanup(srv.Close)

	return srv
}

// S703: the rate of a session is its close over the close of the session before, across the turn of
// the year; the session of today enters once it is over in São Paulo (MI2, MI3).
func TestFetch(t *testing.T) {
	t.Parallel()

	answers := map[string]string{"2025": year2025, "2026": year2026}
	before := []index.Rate{
		{Date: date("2026-01-02"), Value: "-0.003641139816"},
		{Date: date("2026-01-05"), Value: "0.008291272341"},
	}

	for name, tt := range map[string]struct {
		now  string
		want []index.Rate
	}{
		"session running": {"2026-01-06T18:00:00-03:00", before},
		"session over": {"2026-01-06T19:00:00-03:00", append(slices.Clone(before),
			index.Rate{Date: date("2026-01-06"), Value: "0.011083725583"})},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			srv := server(t, "IBOVESPA", answers)
			src := brb3.Ibovespa(srv.Client(), srv.URL, at(tt.now))

			got, err := src.Fetch(t.Context(), date("2026-01-01"), date("2026-01-06"))
			if err != nil {
				t.Fatal(err)
			}

			if !slices.Equal(got, tt.want) {
				t.Errorf("rates = %v, want %v", got, tt.want)
			}
		})
	}
}

// A past year without a session after one with sessions is a failure, not a hole.
func TestFetchFailsOnAnEmptyYear(t *testing.T) {
	t.Parallel()

	srv := server(t, "IFIX", map[string]string{"2024": year2025, "2026": year2026})
	src := brb3.IFIX(srv.Client(), srv.URL, at("2026-01-07T12:00:00-03:00"))

	_, err := src.Fetch(t.Context(), date("2024-06-01"), date("2026-01-06"))
	if err == nil || !strings.Contains(err.Error(), "br_ifix: no session in 2025") {
		t.Errorf("error = %v", err)
	}
}

// The years before the first session of the index hold none.
func TestFetchSkipsTheYearsBeforeTheIndex(t *testing.T) {
	t.Parallel()

	srv := server(t, "IFIX", map[string]string{"2026": year2026})
	src := brb3.IFIX(srv.Client(), srv.URL, at("2026-01-07T12:00:00-03:00"))

	got, err := src.Fetch(t.Context(), date("2024-06-01"), date("2026-01-06"))
	if err != nil || len(got) != 2 {
		t.Errorf("rates = %v, %v, want the two changes of 2026", got, err)
	}
}

func TestFetchRefusesAValueThatIsNotADecimal(t *testing.T) {
	t.Parallel()

	srv := server(
		t,
		"IBOVESPA",
		map[string]string{"2026": `{"results":[{"day":2,"rateValue1":"x"}]}`},
	)
	src := brb3.Ibovespa(srv.Client(), srv.URL, at("2026-01-07T12:00:00-03:00"))

	if _, err := src.Fetch(t.Context(), date("2026-01-01"), date("2026-01-06")); err == nil {
		t.Error("a value that is not a decimal was accepted")
	}
}
