package totalreturn_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/index/totalreturn"
)

func date(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

func at(s string) func() time.Time {
	return func() time.Time {
		v, err := time.Parse(time.RFC3339, s)
		if err != nil {
			panic(err)
		}

		return v
	}
}

// chart is the answer of the chart endpoint for closes by date, with the adjusted closes when given.
func chart(dates, closes, adjusted []string) string {
	stamps := make([]string, len(dates))
	for i, d := range dates {
		stamps[i] = fmt.Sprint(date(d).Add(14*time.Hour + 30*time.Minute).Unix())
	}

	adj := ""
	if adjusted != nil {
		adj = fmt.Sprintf(`,"adjclose":[{"adjclose":[%s]}]`, strings.Join(adjusted, ","))
	}

	return fmt.Sprintf(`{"chart":{"result":[{"meta":{"currency":"USD",
		"exchangeTimezoneName":"America/New_York"},"timestamp":[%s],
		"indicators":{"quote":[{"close":[%s]}]%s}}]}}`,
		strings.Join(stamps, ","), strings.Join(closes, ","), adj)
}

// server answers the chart of each symbol.
func server(t *testing.T, charts map[string]string) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		answer, ok := charts[strings.TrimPrefix(r.URL.Path, "/")]
		if !ok {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write([]byte(answer))
	}))
	t.Cleanup(srv.Close)

	return srv
}

var week = []string{"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"}

// S704: the rate of a session is the change of the total return index. A close 1% under or over what
// the price index moved, or a missing one, takes the ratio of its neighbors, so the sessions beside it
// keep the levels of the source (MI4).
func TestSP500(t *testing.T) {
	t.Parallel()

	for name, tt := range map[string]struct {
		total []string
		want  []string
	}{
		"right closes": {
			[]string{"1000", "1010", "1020.1", "1030.301", "1030.301"},
			[]string{"0.010000000000", "0.010000000000", "0.010000000000", "0.000000000000"},
		},
		"a close under the right one": {
			[]string{"1000", "1010", "1010", "1030.301", "1030.301"},
			[]string{"0.010000000000", "0.010000000000", "0.010000000000", "0.000000000000"},
		},
		"a close over the right one": {
			[]string{"1000", "1010", "1030.301", "1030.301", "1030.301"},
			[]string{"0.010000000000", "0.010000000000", "0.010000000000", "0.000000000000"},
		},
		"a wrong last close": {
			[]string{"1000", "1010", "1020.1", "1030.301", "1020"},
			[]string{"0.010000000000", "0.010000000000", "0.010000000000", "0.000000000000"},
		},
		"a missing close": {
			[]string{"1000", "1010", "null", "1030.301", "1030.301"},
			[]string{"0.010000000000", "0.010000000000", "0.010000000000", "0.000000000000"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			srv := server(t, map[string]string{
				"^GSPC": chart(
					week,
					[]string{"100", "101", "102.01", "103.0301", "103.0301"},
					nil,
				),
				"^SP500TR": chart(week, tt.total, nil),
			})
			src := totalreturn.SP500(srv.Client(), srv.URL, at("2026-01-09T12:00:00-05:00"))

			got, err := src.Fetch(t.Context(), date("2026-01-05"), date("2026-01-09"))
			if err != nil {
				t.Fatal(err)
			}

			if !slices.Equal(values(got), tt.want) {
				t.Errorf("rates = %v, want %v", got, tt.want)
			}
		})
	}
}

// A dividend of 0.1% of the index is a total return inside the band.
func TestSP500KeepsADividend(t *testing.T) {
	t.Parallel()

	srv := server(t, map[string]string{
		"^GSPC":    chart(week[:2], []string{"100", "100"}, nil),
		"^SP500TR": chart(week[:2], []string{"1000", "1001"}, nil),
	})
	src := totalreturn.SP500(srv.Client(), srv.URL, at("2026-01-09T12:00:00-05:00"))

	got, err := src.Fetch(t.Context(), date("2026-01-05"), date("2026-01-09"))
	if err != nil || !slices.Equal(values(got), []string{"0.001000000000"}) {
		t.Errorf("rates = %v, %v, want 0.001", got, err)
	}
}

// A total return that moves away from the price for good is a source that changed, not a wrong close.
func TestSP500FailsOnAChangedSource(t *testing.T) {
	t.Parallel()

	days := []string{
		"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
		"2026-01-12", "2026-01-13",
	}
	srv := server(t, map[string]string{
		"^GSPC": chart(
			days,
			[]string{"100", "100", "100", "100", "100", "100", "100", "100"},
			nil,
		),
		"^SP500TR": chart(
			days,
			[]string{"1000", "1000", "1000", "1000", "900", "900", "900", "900"},
			nil,
		),
	})
	src := totalreturn.SP500(srv.Client(), srv.URL, at("2026-01-14T12:00:00-05:00"))

	_, err := src.Fetch(t.Context(), date("2026-01-05"), date("2026-01-13"))
	if err == nil || !strings.Contains(err.Error(), "us_sp500: total return against the price") {
		t.Errorf("error = %v", err)
	}
}

// A distribution of 2.4% of VT (2011-12-21) is inside its largest one, in the middle of the series
// and on its last session.
func TestFTSEGlobalKeepsADistribution(t *testing.T) {
	t.Parallel()

	days := []string{
		"2011-12-16", "2011-12-19", "2011-12-20", "2011-12-21", "2011-12-22", "2011-12-23",
	}

	for _, n := range []int{4, 6} {
		srv := server(t, map[string]string{"VT": chart(
			days[:n],
			[]string{"41", "41", "41", "40", "40", "40"}[:n],
			[]string{"40", "40", "40", "40", "40", "40"}[:n],
		)})
		src := totalreturn.FTSEGlobal(srv.Client(), srv.URL, at("2012-01-09T12:00:00-05:00"))

		got, err := src.Fetch(t.Context(), date("2011-12-20"), date("2011-12-23"))
		if err != nil {
			t.Fatal(err)
		}

		for _, r := range got {
			if r.Value != "0.000000000000" {
				t.Errorf("%d sessions: rates = %v, want no change of the total return", n, got)
			}
		}
	}
}

// S703: FTSE Global All Cap follows the adjusted closes of VT and starts on 2011-12-19 (MI1).
func TestFTSEGlobal(t *testing.T) {
	t.Parallel()

	srv := server(t, map[string]string{
		"VT": chart(
			[]string{"2011-12-15", "2011-12-16", "2011-12-19", "2011-12-20"},
			[]string{"40", "40", "40", "39.6"},
			[]string{"30", "30", "30", "30"},
		),
	})
	src := totalreturn.FTSEGlobal(srv.Client(), srv.URL, at("2012-01-09T12:00:00-05:00"))

	got, err := src.Fetch(t.Context(), date("2006-01-01"), date("2011-12-20"))
	if err != nil {
		t.Fatal(err)
	}

	want := []index.Rate{
		{Date: date("2011-12-19"), Value: "0.000000000000"},
		{Date: date("2011-12-20"), Value: "0.000000000000"},
	}
	if !slices.Equal(got, want) {
		t.Errorf("rates = %v, want %v", got, want)
	}

	if got, err := src.Fetch(t.Context(), date("2006-01-01"), date("2011-01-01")); err != nil ||
		len(got) != 0 {
		t.Errorf("rates before the start = %v, %v, want none", got, err)
	}
}

func TestFetchStatesAFailure(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "busy", http.StatusServiceUnavailable)
	}))
	t.Cleanup(srv.Close)

	src := totalreturn.SP500(srv.Client(), srv.URL, at("2026-01-09T12:00:00-05:00"))
	if _, err := src.Fetch(t.Context(), date("2026-01-05"), date("2026-01-09")); err == nil {
		t.Error("a 503 gave no error")
	}
}

func values(rates []index.Rate) []string {
	out := make([]string, len(rates))
	for i, r := range rates {
		out[i] = r.Value
	}

	return out
}
