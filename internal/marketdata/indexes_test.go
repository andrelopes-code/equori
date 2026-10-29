package marketdata_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
)

// sgsServer answers the BCB SGS series 12 (CDI, percent a day) and 433 (IPCA, percent a month)
// from fixture rows, keeping the rows inside the dates of the request. Like the SGS, it answers
// 404 for a request whose dates hold no row.
type sgsServer struct {
	mu       sync.Mutex
	requests []string
	fail     bool
	cdi      [][2]string // date as dd/MM/yyyy, percent
	ipca     [][2]string
}

func (s *sgsServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.requests = append(s.requests, r.URL.RequestURI())
	fail := s.fail
	s.mu.Unlock()
	if fail {
		http.Error(w, "busy", http.StatusServiceUnavailable)
		return
	}
	var rows [][2]string
	switch r.URL.Path {
	case "/dados/serie/bcdata.sgs.12/dados":
		rows = s.cdi
	case "/dados/serie/bcdata.sgs.433/dados":
		rows = s.ipca
	default:
		http.NotFound(w, r)
		return
	}
	from, _ := time.Parse("02/01/2006", r.URL.Query().Get("dataInicial"))
	to, _ := time.Parse("02/01/2006", r.URL.Query().Get("dataFinal"))
	var items []string
	for _, row := range rows {
		d, _ := time.Parse("02/01/2006", row[0])
		if !d.Before(from) && !d.After(to) {
			items = append(items, fmt.Sprintf(`{"data":%q,"valor":%q}`, row[0], row[1]))
		}
	}
	if len(items) == 0 {
		w.WriteHeader(http.StatusNotFound)
		_, _ = fmt.Fprint(w, `{"erro":{"statusCode":404,"detail":"Value(s) not found"}}`)
		return
	}
	_, _ = fmt.Fprintf(w, "[%s]", strings.Join(items, ","))
}

func (s *sgsServer) take() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.requests
	s.requests = nil
	return out
}

func (s *sgsServer) setFail(v bool) {
	s.mu.Lock()
	s.fail = v
	s.mu.Unlock()
}

func indexURLs(srv *httptest.Server) map[string]string {
	return map[string]string{"br_cdi": srv.URL, "br_ipca": srv.URL}
}

// cdiWeek is five business days of January 2026 at 0.055131 percent a day.
var cdiWeek = [][2]string{
	{"02/01/2026", "0.055131"}, {"05/01/2026", "0.055131"}, {"06/01/2026", "0.055131"},
	{"07/01/2026", "0.055131"}, {"08/01/2026", "0.055131"}, {"09/01/2026", "0.055131"},
}

type indexRateRow struct {
	Date   string
	Rate   string
	Source string
}

func indexRates(t *testing.T, h *apitest.Harness, index string) []indexRateRow {
	t.Helper()
	rows, err := h.Pool.Query(t.Context(), `SELECT to_char(date, 'YYYY-MM-DD'), rate::text, source FROM marketdata_index_rate WHERE index_id = $1 ORDER BY date`, index)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []indexRateRow
	for rows.Next() {
		var r indexRateRow
		if err := rows.Scan(&r.Date, &r.Rate, &r.Source); err != nil {
			t.Fatal(err)
		}
		out = append(out, r)
	}
	return out
}

func TestIndexFeeds(t *testing.T) {
	t.Parallel()
	s := &sgsServer{cdi: cdiWeek, ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-01-09"), apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, indexURLs(srv)))

	// A source that answers 503 is logged and fetched again on the next tick.
	s.setFail(true)
	h.App.Marketdata.TickFeeds(t.Context())
	if got := indexRates(t, h, "cdi"); len(got) != 0 {
		t.Fatalf("rates after a failed tick = %v", got)
	}
	if logs := h.Logs(); !strings.Contains(logs, "source=br_cdi") {
		t.Fatalf("logs = %s", logs)
	}
	s.take()
	s.setFail(false)

	// An enabled index is fetched from 20 years before today, though no security follows it.
	h.App.Marketdata.TickFeeds(t.Context())
	var got []string
	for _, r := range s.take() {
		if strings.Contains(r, "bcdata.sgs.12/dados") {
			got = append(got, r)
		}
	}
	if len(got) != 5 || !strings.Contains(got[0], "dataInicial=09%2F01%2F2006") || !strings.Contains(got[4], "dataFinal=09%2F01%2F2026") {
		t.Fatalf("requests = %v", got)
	}
	rates := indexRates(t, h, "cdi")
	if len(rates) != 6 || rates[0] != (indexRateRow{"2026-01-02", "0.000551310000", "br_cdi"}) || rates[5].Date != "2026-01-09" {
		t.Fatalf("rates = %+v", rates)
	}

	// Every CDI day up to today is stored: the next tick sends no CDI request. The IPCA's
	// latest rate is of January 1, so its series is asked again from January 2.
	h.App.Marketdata.TickFeeds(t.Context())
	for _, r := range s.take() {
		if strings.Contains(r, "bcdata.sgs.12/dados") {
			t.Fatalf("CDI request after a complete fetch: %s", r)
		}
	}
}

func TestIndexFeedsIPCA(t *testing.T) {
	t.Parallel()
	s := &sgsServer{ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-03-15"), apitest.IndexFeeds([]string{"br_ipca"}, indexURLs(srv)))
	defineFixedIncome(t, h, "NTNBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/NTNBXPTO/terms", map[string]any{
		"issued_on": "2026-01-01", "matures_on": "2035-05-15", "index_id": "ipca", "spread_bp": 600, "day_count": "act365", "face_value": 100000,
	}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())
	rates := indexRates(t, h, "ipca")
	if len(rates) != 2 || rates[0] != (indexRateRow{"2026-01-01", "0.004200000000", "br_ipca"}) || rates[1] != (indexRateRow{"2026-02-01", "-0.003000000000", "br_ipca"}) {
		t.Fatalf("rates = %+v", rates)
	}

	// The days after the latest rate hold no published rate yet: the SGS answers 404 and the
	// tick succeeds without a new rate.
	h.App.Marketdata.TickFeeds(t.Context())
	if logs := h.Logs(); strings.Contains(logs, "source=br_ipca") {
		t.Fatalf("logs = %s", logs)
	}
	if got := indexRates(t, h, "ipca"); len(got) != 2 {
		t.Fatalf("rates = %+v", got)
	}
}

func TestNewIndexSources(t *testing.T) {
	t.Parallel()
	if got := marketdata.IndexSourceIDs(); !slices.Equal(got, []string{"br_cdi", "br_ipca", "eu_estr", "ea_hicp", "us_sofr", "us_cpi"}) {
		t.Fatalf("IndexSourceIDs = %v", got)
	}
	if _, err := marketdata.NewIndexSources([]string{"nope"}, nil, http.DefaultClient); err == nil || !strings.Contains(err.Error(), "EQUORI_INDEX_FEEDS") || !strings.Contains(err.Error(), "nope") {
		t.Fatalf("error = %v", err)
	}
	if got, err := marketdata.NewIndexSources([]string{"br_cdi"}, nil, http.DefaultClient); err != nil || len(got) != 1 || got[0].ID() != "br_cdi" {
		t.Fatalf("sources = %v, %v", got, err)
	}
}
