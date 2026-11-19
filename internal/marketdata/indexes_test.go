package marketdata_test

import (
	"fmt"
	"math/big"
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
	selic    [][2]string
	igpm     [][2]string
	ptax     [][2]string // date as dd/MM/yyyy, reais per dollar
	// ipcaLevels are IBGE index numbers of the IPCA as YYYYMM and level; empty, the levels follow
	// from ipca, starting at 1000 the month before its first.
	ipcaLevels [][2]string
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

	if strings.HasPrefix(r.URL.Path, "/values/t/1737/n1/all/v/2266/p/") {
		s.serveSIDRA(w, strings.TrimPrefix(r.URL.Path, "/values/t/1737/n1/all/v/2266/p/"))

		return
	}

	var rows [][2]string
	switch r.URL.Path {
	case "/dados/serie/bcdata.sgs.12/dados":
		rows = s.cdi
	case "/dados/serie/bcdata.sgs.433/dados":
		rows = s.ipca
	case "/dados/serie/bcdata.sgs.11/dados":
		rows = s.selic
	case "/dados/serie/bcdata.sgs.28655/dados":
		rows = s.igpm
	case "/dados/serie/bcdata.sgs.1/dados":
		rows = s.ptax
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

// serveSIDRA answers the IPCA index numbers of the months in span (YYYYMM-YYYYMM) as the IBGE
// SIDRA API does: a header row, then one row per month.
func (s *sgsServer) serveSIDRA(w http.ResponseWriter, span string) {
	first, last, _ := strings.Cut(span, "-")
	items := []string{`{"V":"Valor","D3C":"Mês (Código)"}`}

	for _, l := range s.levels() {
		if l[0] >= first && l[0] <= last {
			items = append(items, fmt.Sprintf(`{"V":%q,"D3C":%q}`, l[1], l[0]))
		}
	}

	_, _ = fmt.Fprintf(w, "[%s]", strings.Join(items, ","))
}

// levels are ipcaLevels, or the levels the percents of ipca compound from 1000.
func (s *sgsServer) levels() [][2]string {
	if len(s.ipcaLevels) > 0 || len(s.ipca) == 0 {
		return s.ipcaLevels
	}

	first, _ := time.Parse("02/01/2006", s.ipca[0][0])
	level := big.NewRat(1000, 1)
	out := [][2]string{{first.AddDate(0, -1, 0).Format("200601"), "1000"}}

	for _, row := range s.ipca {
		d, _ := time.Parse("02/01/2006", row[0])
		p, _ := new(big.Rat).SetString(row[1])
		level.Mul(level, new(big.Rat).Add(big.NewRat(1, 1), p.Quo(p, big.NewRat(100, 1))))
		out = append(out, [2]string{d.Format("200601"), level.FloatString(20)})
	}

	return out
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
	return map[string]string{
		"br_cdi":      srv.URL,
		"br_ipca":     srv.URL,
		"br_selic":    srv.URL,
		"br_igpm":     srv.URL,
		"br_ptax_usd": srv.URL,
	}
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

	rows, err := h.Pool.Query(
		t.Context(),
		`SELECT to_char(date, 'YYYY-MM-DD'), rate::text, source FROM marketdata_index_rate WHERE index_id = $1 ORDER BY date`,
		index,
	)
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

	s := &sgsServer{
		cdi:  cdiWeek,
		ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}},
	}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, indexURLs(srv)),
	)

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

	if len(got) != 5 || !strings.Contains(got[0], "dataInicial=09%2F01%2F2006") ||
		!strings.Contains(got[4], "dataFinal=09%2F01%2F2026") {
		t.Fatalf("requests = %v", got)
	}

	rates := indexRates(t, h, "cdi")
	if len(rates) != 6 || rates[0] != (indexRateRow{"2026-01-02", "0.000551310000", "br_cdi"}) ||
		rates[5].Date != "2026-01-09" {
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
	h := apitest.New(
		t,
		apitest.Today("2026-03-15"),
		apitest.IndexFeeds([]string{"br_ipca"}, indexURLs(srv)),
	)
	defineFixedIncome(t, h, "NTNBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/NTNBXPTO/terms", map[string]any{
		"issued_on":  "2026-01-01",
		"matures_on": "2035-05-15",
		"index_id":   "ipca",
		"spread_bp":  600,
		"day_count":  "act365",
		"face_value": 100000,
	}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	rates := indexRates(t, h, "ipca")
	if len(rates) != 2 || rates[0] != (indexRateRow{"2026-01-01", "0.004200000000", "br_ipca"}) ||
		rates[1] != (indexRateRow{"2026-02-01", "-0.003000000000", "br_ipca"}) {
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

// Coverage row F-21: the Selic (SGS series 11, percent a day) and the IGP-M (SGS series 189,
// percent a month) are stored like the CDI and the IPCA for the terms that name them.
func TestIndexFeedsSelicAndIGPM(t *testing.T) {
	t.Parallel()

	s := &sgsServer{
		selic: [][2]string{{"02/01/2026", "0.055131"}, {"05/01/2026", "0.055131"}},
		igpm:  [][2]string{{"01/12/2025", "0.27"}},
	}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-06"),
		apitest.IndexFeeds([]string{"br_selic", "br_igpm"}, indexURLs(srv)),
	)

	for code, index := range map[string]string{"LFTXPTO": "selic", "NTNCXPTO": "igpm"} {
		defineFixedIncome(t, h, code)
		h.MustDo(http.MethodPut, "/api/v1/instruments/"+code+"/terms", map[string]any{
			"issued_on":  "2025-12-01",
			"matures_on": "2031-01-01",
			"index_id":   index,
			"day_count":  "act365",
			"face_value": 100000,
		}, http.StatusOK, nil)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	if got := indexRates(t, h, "selic"); len(got) != 2 ||
		got[0] != (indexRateRow{"2026-01-02", "0.000551310000", "br_selic"}) {
		t.Errorf("selic = %+v", got)
	}

	if got := indexRates(t, h, "igpm"); len(got) != 1 ||
		got[0] != (indexRateRow{"2025-12-01", "0.002700000000", "br_igpm"}) {
		t.Errorf("igpm = %+v", got)
	}
}

// Coverage row F-21: a security indexed to the dollar accrues by the variation of the PTAX selling
// rate (SGS series 1): the rate of a business day is its quote over the quote of the day before,
// less one, so the price of a day is the quote of D-1 over the quote of the day before the issue.
func TestIndexFeedDollar(t *testing.T) {
	t.Parallel()

	s := &sgsServer{ptax: [][2]string{
		{"31/12/2025", "5.0000"}, {"02/01/2026", "5.1000"}, {"05/01/2026", "5.0490"},
		{"06/01/2026", "5.2000"},
	}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-06"),
		apitest.IndexFeeds([]string{"br_ptax_usd"}, indexURLs(srv)),
	)

	defineFixedIncome(t, h, "USDXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/USDXPTO/terms", map[string]any{
		"issued_on":  "2026-01-02",
		"matures_on": "2031-01-02",
		"index_id":   "usd_brl",
		"day_count":  "act365",
		"face_value": 100000,
	}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	want := []indexRateRow{
		{"2026-01-02", "0.020000000000", "br_ptax_usd"},
		{"2026-01-05", "-0.010000000000", "br_ptax_usd"},
		{"2026-01-06", "0.029906912260", "br_ptax_usd"},
	}
	if got := indexRates(t, h, "usd_brl"); !slices.Equal(got, want) {
		t.Errorf("usd_brl = %+v, want %+v", got, want)
	}

	// 1,000.00 × 5.0490 (2026-01-05) / 5.0000 (2025-12-31).
	got := pricesBetween(t, h, "USDXPTO", "2026-01-06", "2026-01-06")
	if got["2026-01-06"].Value != "1009.8" {
		t.Errorf("price on 2026-01-06 = %+v, want 1009.8", got["2026-01-06"])
	}
}

// Coverage rows T-05 and F-03: the IPCA comes from the index numbers of the IBGE (SIDRA table 1737,
// variable 2266), each month the exact ratio of its number to the number before, so the product of
// the months is the ratio of the numbers the Tesouro Nacional uses for the VNA of an NTN-B.
func TestIndexFeedIPCAFromIBGE(t *testing.T) {
	t.Parallel()

	s := &sgsServer{ipcaLevels: [][2]string{
		{"200006", "1614.62"}, {"200007", "1640.62"}, {"200008", "1662.11"},
	}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2000-09-05"),
		apitest.IndexFeeds([]string{"br_ipca"}, indexURLs(srv)),
	)
	h.App.Marketdata.TickFeeds(t.Context())

	want := []indexRateRow{
		{"2000-07-01", "0.01610286011569285652", "br_ipca"},
		{"2000-08-01", "0.01309870658653435896", "br_ipca"},
	}
	if got := indexRates(t, h, "ipca"); !slices.Equal(got, want) {
		t.Errorf("ipca = %+v, want %+v", got, want)
	}
}

// The VNA of a Tesouro bond counts the index from July 2000, more than 20 years back: the IPCA is
// read from that base even on a first fetch, and a store that starts later is filled back to it.
func TestIndexFeedReachesTheBondBase(t *testing.T) {
	t.Parallel()

	s := &sgsServer{ipcaLevels: [][2]string{
		{"200006", "1614.62"}, {"200007", "1640.62"}, {"202511", "7400.00"}, {"202512", "7437.00"},
	}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-06"),
		apitest.IndexFeeds([]string{"br_ipca"}, indexURLs(srv)),
	)

	if _, err := h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('ipca', '2025-12-01', 0.005, 'br_ipca')`,
	); err != nil {
		t.Fatal(err)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	got := indexRates(t, h, "ipca")
	if len(got) != 2 ||
		got[0] != (indexRateRow{"2000-07-01", "0.01610286011569285652", "br_ipca"}) {
		t.Errorf("ipca = %+v, want the rate of 2000-07 filled back and 2025-12", got)
	}
}

func TestNewIndexSources(t *testing.T) {
	t.Parallel()

	if got := marketdata.IndexSourceIDs(); !slices.Equal(
		got,
		[]string{
			"br_cdi",
			"br_ipca",
			"br_selic",
			"br_igpm",
			"br_ptax_usd",
			"eu_estr",
			"ea_hicp",
			"us_sofr",
			"us_cpi",
		},
	) {
		t.Fatalf("IndexSourceIDs = %v", got)
	}

	if _, err := marketdata.NewIndexSources(
		[]string{"nope"},
		nil,
		http.DefaultClient,
	); err == nil || !strings.Contains(err.Error(), "unknown index feed") ||
		!strings.Contains(err.Error(), "nope") {
		t.Fatalf("error = %v", err)
	}

	if got, err := marketdata.NewIndexSources(
		[]string{"br_cdi"},
		nil,
		http.DefaultClient,
	); err != nil || len(got) != 1 ||
		got[0].ID() != "br_cdi" {
		t.Fatalf("sources = %v, %v", got, err)
	}
}

// A business-day index other than the CDI counts bus252 only with a calendar_id: the stored terms
// refuse it, and the answer is a validation problem on day_count, not an internal error.
func TestTermsRefuseBus252OfAnotherIndex(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-01-06"))
	defineFixedIncome(t, h, "LFTBUS")

	h.ExpectProblem(
		h.Do(http.MethodPut, "/api/v1/instruments/LFTBUS/terms", map[string]any{
			"issued_on":  "2026-01-02",
			"matures_on": "2031-01-02",
			"index_id":   "selic",
			"day_count":  "bus252",
			"face_value": 100000,
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"day_count",
	)
}
