package marketdata_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// foreignIndexServer answers the ECB Data Portal (€STR), the New York Fed Markets Data API
// (SOFR), the Eurostat dissemination API (HICP) and the BLS public API (CPI-U) from fixture rows,
// keeping the rows inside the period of the request.
type foreignIndexServer struct {
	mu   sync.Mutex
	estr [][2]string // date, percent a year
	sofr [][2]string
	hicp [][2]string // month, level
	cpiu [][3]string // year, period, level
}

func (s *foreignIndexServer) set(f func(s *foreignIndexServer)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f(s)
}

func (s *foreignIndexServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	q := r.URL.Query()
	switch r.URL.Path {
	case "/service/data/EST/B.EU000A2X2A25.WT":
		var lines []string
		for _, row := range s.estr {
			if row[0] >= q.Get("startPeriod") && row[0] <= q.Get("endPeriod") {
				lines = append(lines, fmt.Sprintf("EST.B.EU000A2X2A25.WT,B,%s,%s,\"Euro short-term rate, Volume-weighted\"", row[0], row[1]))
			}
		}
		if len(lines) > 0 {
			_, _ = fmt.Fprintf(w, "KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE_COMPL\n%s\n", strings.Join(lines, "\n"))
		}
	case "/api/rates/secured/sofr/search.json":
		var items []string
		for _, row := range s.sofr {
			if row[0] >= q.Get("startDate") && row[0] <= q.Get("endDate") {
				items = append(items, fmt.Sprintf(`{"effectiveDate":%q,"type":"SOFR","percentRate":%s}`, row[0], row[1]))
			}
		}
		_, _ = fmt.Fprintf(w, `{"refRates":[%s]}`, strings.Join(items, ","))
	case "/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr":
		index, value := map[string]int{}, map[string]json.RawMessage{}
		for _, row := range s.hicp {
			if row[0] >= q.Get("sinceTimePeriod") && row[0] <= q.Get("untilTimePeriod") {
				index[row[0]] = len(index)
				value[strconv.Itoa(index[row[0]])] = json.RawMessage(row[1])
			}
		}
		doc := map[string]any{"value": value, "dimension": map[string]any{"time": map[string]any{"category": map[string]any{"index": index}}}}
		_ = json.NewEncoder(w).Encode(doc)
	case "/publicAPI/v1/timeseries/data/":
		var req struct{ StartYear, EndYear string }
		_ = json.NewDecoder(r.Body).Decode(&req)
		var data []map[string]string
		for _, row := range slices.Backward(s.cpiu) {
			if row[0] >= req.StartYear && row[0] <= req.EndYear {
				data = append(data, map[string]string{"year": row[0], "period": row[1], "value": row[2]})
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "REQUEST_SUCCEEDED", "Results": map[string]any{"series": []any{map[string]any{"seriesID": "CUUR0000SA0", "data": data}}}})
	default:
		http.NotFound(w, r)
	}
}

func foreignIndexHarness(t *testing.T, s *foreignIndexServer, today string) *apitest.Harness {
	t.Helper()
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	ids := []string{"eu_estr", "us_sofr", "ea_hicp", "us_cpi"}
	urls := map[string]string{}
	for _, id := range ids {
		urls[id] = srv.URL
	}
	return apitest.New(t, apitest.Today(today), apitest.IndexFeeds(ids, urls))
}

// An overnight rate accrues each calendar day at the rate last published, over 360: a weekend
// accrues Friday's rate once Monday's publication shows where Friday's rate ends.
func TestOvernightIndexFeeds(t *testing.T) {
	t.Parallel()
	s := &foreignIndexServer{
		estr: [][2]string{{"2026-01-08", "1.8"}, {"2026-01-09", "3.6"}},
		sofr: [][2]string{{"2026-01-09", "3.60"}, {"2026-01-12", "1.80"}},
	}
	h := foreignIndexHarness(t, s, "2026-01-13")
	h.App.Marketdata.TickFeeds(t.Context())
	want := []indexRateRow{{"2026-01-08", "0.000050000000", "eu_estr"}, {"2026-01-09", "0.000100000000", "eu_estr"}}
	if got := indexRates(t, h, "estr"); !slices.Equal(got, want) {
		t.Fatalf("€STR before Monday = %+v", got)
	}

	s.set(func(s *foreignIndexServer) { s.estr = append(s.estr, [2]string{"2026-01-12", "1.8"}) })
	h.App.Marketdata.TickFeeds(t.Context())
	want = append(want,
		indexRateRow{"2026-01-10", "0.000100000000", "eu_estr"},
		indexRateRow{"2026-01-11", "0.000100000000", "eu_estr"},
		indexRateRow{"2026-01-12", "0.000050000000", "eu_estr"},
	)
	slices.SortFunc(want, func(a, b indexRateRow) int { return strings.Compare(a.Date, b.Date) })
	if got := indexRates(t, h, "estr"); !slices.Equal(got, want) {
		t.Fatalf("€STR after Monday = %+v", got)
	}

	if got := indexRates(t, h, "sofr"); !slices.Equal(got, []indexRateRow{
		{"2026-01-09", "0.000100000000", "us_sofr"},
		{"2026-01-10", "0.000100000000", "us_sofr"},
		{"2026-01-11", "0.000100000000", "us_sofr"},
		{"2026-01-12", "0.000050000000", "us_sofr"},
	}) {
		t.Fatalf("SOFR = %+v", got)
	}
}

// A price index's month accrues its level over the level of the month before; the BLS annual
// average (M13) is not a month.
func TestPriceIndexFeeds(t *testing.T) {
	t.Parallel()
	s := &foreignIndexServer{
		hicp: [][2]string{{"2025-11", "100"}, {"2025-12", "100.5"}, {"2026-01", "101"}},
		cpiu: [][3]string{{"2025", "M11", "299.000"}, {"2025", "M12", "300.000"}, {"2025", "M13", "299.500"}, {"2026", "M01", "303.000"}},
	}
	h := foreignIndexHarness(t, s, "2026-02-20")
	h.App.Marketdata.TickFeeds(t.Context())
	if got := indexRates(t, h, "hicp"); !slices.Equal(got, []indexRateRow{
		{"2025-12-01", "0.005000000000", "ea_hicp"},
		{"2026-01-01", "0.004975124378", "ea_hicp"},
	}) {
		t.Fatalf("HICP = %+v", got)
	}
	if got := indexRates(t, h, "cpi_u"); !slices.Equal(got, []indexRateRow{
		{"2025-12-01", "0.003344481605", "us_cpi"},
		{"2026-01-01", "0.010000000000", "us_cpi"},
	}) {
		t.Fatalf("CPI-U = %+v", got)
	}
}
