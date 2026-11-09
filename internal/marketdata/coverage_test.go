package marketdata_test

import (
	"net/http"
	"reflect"
	"testing"
)

type coverageDoc struct {
	First   *string `json:"first"`
	Last    *string `json:"last"`
	Count   int     `json:"count"`
	Stale   bool    `json:"stale"`
	Sources []struct {
		ID       string  `json:"id"`
		Enabled  bool    `json:"enabled"`
		Official bool    `json:"official"`
		First    *string `json:"first"`
		Last     *string `json:"last"`
		History  *struct {
			From  string  `json:"from"`
			Done  bool    `json:"done"`
			Error *string `json:"error"`
		} `json:"history"`
	} `json:"sources"`
}

type coverageSource struct {
	ID          string
	Enabled     bool
	First, Last string
}

// sources flattens the sources of a coverage; every source of these cases has no history row,
// and only yahoo_chart is unofficial.
func (c coverageDoc) sources(t *testing.T) []coverageSource {
	t.Helper()

	out := make([]coverageSource, len(c.Sources))
	for i, s := range c.Sources {
		if s.History != nil || s.Official != (s.ID != "yahoo_chart") {
			t.Fatalf("source %+v", s)
		}

		out[i] = coverageSource{ID: s.ID, Enabled: s.Enabled, First: deref(s.First), Last: deref(s.Last)}
	}

	return out
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

// A222 MQ23, MQ24: the coverage of a currency reads its prices against any quote; it is stale
// after the last price date plus 2 days plus the lag of the source.
func TestCoverage(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		today string
		first string
		count int
		stale bool
	}{
		{"2026-11-13", "2026-10-14", 17, false},
		{"2026-11-14", "2026-10-15", 16, true},
	} {
		t.Run(tc.today, func(t *testing.T) {
			t.Parallel()

			h, _ := seededPTAXHarness(t, tc.today)
			h.App.Marketdata.TickFeeds(t.Context())

			var in struct {
				Coverage coverageDoc `json:"coverage"`
			}
			h.MustDo(http.MethodGet, "/api/v1/instruments/USD", nil, http.StatusOK, &in)

			c := in.Coverage
			if deref(c.First) != tc.first || deref(c.Last) != "2026-11-06" || c.Count != tc.count || c.Stale != tc.stale {
				t.Fatalf("coverage = %+v", c)
			}

			want := []coverageSource{{"bcb_ptax", true, tc.first, "2026-11-06"}, {"ecb", false, "", ""}}
			if got := c.sources(t); !reflect.DeepEqual(got, want) {
				t.Fatalf("sources = %+v, want %+v", got, want)
			}
		})
	}
}

// A222 MQ23: a security reads its prices against its quote currency, with no source stale.
func TestCoverageOfSecurity(t *testing.T) {
	t.Parallel()

	h, _ := seededPTAXHarness(t, "2026-11-09")
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-29", "value": "9.36",
	}, http.StatusCreated, nil)

	var in struct {
		Coverage coverageDoc `json:"coverage"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &in)

	c := in.Coverage
	if deref(c.First) != "2026-10-29" || deref(c.Last) != "2026-10-29" || c.Count != 1 || c.Stale {
		t.Fatalf("coverage = %+v", c)
	}

	want := []coverageSource{{ID: "b3_cotahist"}, {ID: "b3_consolidated"}, {ID: "yahoo_chart"}}
	if got := c.sources(t); !reflect.DeepEqual(got, want) {
		t.Fatalf("sources = %+v, want %+v", got, want)
	}
}
