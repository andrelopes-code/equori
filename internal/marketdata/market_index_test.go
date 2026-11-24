package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S703: the rates of the Ibovespa are read through the tick and listed as an index of the kind
// market, beside the CDI of the kind rate (MI2, MI6).
func TestS703MarketIndexes(t *testing.T) {
	t.Parallel()

	b3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"results":[
			{"day":2,"rateValue1":"100.000,00"},
			{"day":5,"rateValue1":"101.000,00"}]}`))
	}))
	t.Cleanup(b3.Close)

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)

	urls := indexURLs(srv)
	urls["br_ibovespa"] = b3.URL

	h := apitest.New(
		t,
		apitest.Today("2006-01-09"),
		apitest.IndexFeeds([]string{"br_cdi", "br_ibovespa"}, urls),
	)

	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('cdi', '2006-01-02', 0.0006, 'br_cdi')`)
	execSQL(t, h, `INSERT INTO marketdata_index_check VALUES
		('ibovespa', '1986-01-09', '2006-01-09', 0)`)
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('ibovespa', '2006-01-02', 0.01, 'br_ibovespa')`)

	h.App.Marketdata.TickFeeds(t.Context())

	want := []indexRateRow{
		{"2006-01-02", "0.01", "br_ibovespa"},
		{"2006-01-05", "0.010000000000", "br_ibovespa"},
	}
	if got := indexRates(t, h, "ibovespa"); !slices.Equal(got, want) {
		t.Errorf("ibovespa = %v, want %v", got, want)
	}

	var list struct {
		Items []struct {
			ID     string `json:"id"`
			Period string `json:"period"`
			Kind   string `json:"kind"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/indexes", nil, http.StatusOK, &list)

	kinds := make(map[string]string)
	for _, x := range list.Items {
		kinds[x.ID] = x.Period + " " + x.Kind
	}

	if kinds["cdi"] != "day rate" || kinds["ibovespa"] != "day market" {
		t.Errorf("indexes = %v, want cdi of the kind rate and ibovespa of the kind market", kinds)
	}
}

// S705: a market index of a source without terms for this use needs an explicit acceptance; the
// ones of the B3 do not and are suggested in Brazil (MI5).
func TestS705UnofficialMarketIndex(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-01"))

	for _, id := range []string{"us_sp500", "global_ftse"} {
		path := "/api/v1/market-data/feeds/" + id

		r := h.Do(http.MethodPut, path, map[string]any{"enabled": true})
		if r.Status != http.StatusUnprocessableEntity ||
			!strings.Contains(string(r.Body), `"code":"unofficial_source"`) {
			t.Errorf("%s without acceptance = %d %s", id, r.Status, r.Body)
		}

		var got feedAPI
		h.MustDo(http.MethodPut, path,
			map[string]any{"enabled": true, "accept_unofficial": true}, http.StatusOK, &got)

		if !got.Enabled || got.Official || got.Suggested {
			t.Errorf("%s = %+v, want enabled, unofficial and not suggested", id, got)
		}
	}

	for _, id := range []string{"br_ibovespa", "br_ifix"} {
		if f := feedsOf(t, h)[id]; !f.Official || !f.Suggested || f.Kind != "index" {
			t.Errorf("%s = %+v, want an official and suggested index", id, f)
		}
	}
}

// RI5: the CDI of Thursday 2026-11-19, before the holiday of 2026-11-20, is late once three
// business days passed without a rate; the Ibovespa, without a calendar, after four weekdays.
func TestDailyIndexStale(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		today, feed, index string
		want               bool
	}{
		{"2026-11-25", "br_cdi", "cdi", false},
		{"2026-11-26", "br_cdi", "cdi", true},
		{"2026-11-25", "br_ibovespa", "ibovespa", false},
		{"2026-11-26", "br_ibovespa", "ibovespa", true},
	} {
		t.Run(tt.today+" "+tt.index, func(t *testing.T) {
			t.Parallel()

			h := apitest.New(
				t,
				apitest.Today(tt.today),
				apitest.IndexFeeds([]string{tt.feed}, nil),
			)
			execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
				VALUES ('`+tt.index+`', '2026-11-19', 0.0005, '`+tt.feed+`')`)
			execSQL(t, h, `INSERT INTO marketdata_index_check
				VALUES ('`+tt.index+`', '2006-11-19', '2026-11-20', 0)`)

			if f := feedsOf(t, h)[tt.feed]; f.Stale != tt.want {
				t.Errorf("%s on %s: stale = %v, want %v", tt.feed, tt.today, f.Stale, tt.want)
			}
		})
	}
}

// S701: the expected days without a rate that a whole read leaves are stated on the feed: three
// business days of the CDI, two months of the IPCA and the weekdays of a run of 8 days without a
// session of the Ibovespa (RI3, RI4).
func TestFeedStatesTheHolesOfAnIndex(t *testing.T) {
	t.Parallel()

	s := &sgsServer{
		cdi: [][2]string{{"02/01/2026", "0.05"}, {"08/01/2026", "0.05"}},
		ipcaLevels: [][2]string{
			{"202508", "100"},
			{"202509", "101"},
			{"202511", "102"},
			{"202512", "103"},
		},
	}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)

	b3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"results":[
			{"day":5,"rateValue1":"100,00"}, {"day":6,"rateValue1":"100,00"},
			{"day":14,"rateValue1":"100,00"}]}`))
	}))
	t.Cleanup(b3.Close)

	urls := indexURLs(srv)
	urls["br_ibovespa"] = b3.URL

	h := apitest.New(
		t,
		apitest.Today("2026-01-15"),
		apitest.IndexFeeds([]string{"br_cdi", "br_ipca", "br_ibovespa"}, urls),
	)
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('ibovespa', '2026-01-06', 0, 'br_ibovespa')`)
	execSQL(t, h, `INSERT INTO marketdata_index_check VALUES
		('ibovespa', '2006-01-15', '2026-01-15', 0)`)

	h.App.Marketdata.TickFeeds(t.Context())

	fs := feedsOf(t, h)
	for id, want := range map[string]int{"br_cdi": 3, "br_ipca": 2, "br_ibovespa": 5} {
		if fs[id].Missing != want {
			t.Errorf("%s: missing = %d, want %d", id, fs[id].Missing, want)
		}
	}
}

// RI4: an enabled index that was never read whole is loading, not late: a stale date of a load that
// runs states no lateness, and the load counts as a pending history.
func TestIndexNeverReadWholeIsLoading(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-24"), apitest.IndexFeeds([]string{"br_ifix"}, nil))
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('ifix', '2020-11-13', 0.001, 'br_ifix')`)

	if f := feedsOf(t, h)["br_ifix"]; f.Stale || f.HistoryPending != 1 {
		t.Errorf("loading: %+v, want not stale and 1 pending history", f)
	}

	execSQL(
		t,
		h,
		`INSERT INTO marketdata_index_check VALUES ('ifix', '2006-11-24', '2026-11-24', 0)`,
	)

	if f := feedsOf(t, h)["br_ifix"]; !f.Stale || f.HistoryPending != 0 {
		t.Errorf("read whole: %+v, want stale and no pending history", f)
	}
}
