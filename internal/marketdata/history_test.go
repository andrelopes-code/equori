package marketdata_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A222 MQ4, MQ6, MQ9, S357: enabling a source loads twenty years in the next tick.
func TestS357EnableLoadsTwentyYears(t *testing.T) {
	t.Parallel()

	h, _ := ptaxHarness(t)

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 false ")

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 true ")
	assertRows(t, usdCount(h, ""), "1468")
}

// A222 MQ5, S359: the same request twice changes nothing.
func TestS359SameHistoryTwice(t *testing.T) {
	t.Parallel()

	h, p := ptaxHarness(t)
	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)
	h.App.Marketdata.TickFeeds(t.Context())
	p.take()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)
	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, usdCount(h, ""), "1468")
	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 true ")

	if got := p.requestsWith("@dataInicial='11-09-2006'"); len(got) != 0 {
		t.Fatalf("requests of the first window = %v", got)
	}
}

// A222 MQ9, S360: a failed history stays pending, stores nothing and runs again.
func TestS360HistoryFailureStaysPending(t *testing.T) {
	t.Parallel()

	h, p := ptaxHarness(t)
	p.setFail("11-09-2006")
	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 false fetch PTAX USD: status 500")
	assertRows(t, usdCount(h, " AND date < '2026-10-10'"), "0")

	p.setFail("")
	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 true ")
	assertRows(t, usdCount(h, ""), "1468")
}

// A222 MQ12, S358: a B3 history reads the year files, then the days after the last record.
func TestS358B3YearFiles(t *testing.T) {
	t.Parallel()

	b := &b3Fake{years: map[string][]byte{
		"2021": yearFile(
			"2021",
			cotahistRecord("20211108", "PETR4", "010", 2850),
			cotahistRecord("20211110", "PETR4", "010", 2900),
		),
		"2022": yearFile(
			"2022",
			cotahistRecord("20220615", "PETR4", "010", 3010),
			cotahistRecord("20220615", "PETR4", "070", 3999),
		),
		"2023": yearFile("2023", cotahistRecord("20230301", "PETR4", "010", 2512)),
		"2024": yearFile(
			"2024",
			cotahistRecord("20241230", "PETR4", "010", 3699),
			cotahistRecord("20241230", "VALE3", "010", 6100),
		),
		"2025": yearFile("2025", cotahistRecord("20250701", "PETR4", "010", 3150)),
		"2026": yearFile("2026", cotahistRecord("20261106", "PETR4", "010", 3245)),
	}}
	srv := httptest.NewServer(b)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-11-09"), apitest.PriceFeeds([]string{"b3_consolidated"},
		map[string]string{"b3_consolidated": srv.URL + "/b3c", "b3_cotahist": srv.URL + "/b3"}))

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "PETR4",
		"type":           "stock",
		"scale":          0,
		"name":           "Petrobras PN",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}, http.StatusCreated, nil)

	assertRows(t, historyRow(h, "b3_consolidated", "PETR4"), "2021-11-09 false ")

	h.App.Marketdata.TickFeeds(t.Context())

	got := b.take()
	for year := 2021; year <= 2026; year++ {
		if n := len(filter(got, fmt.Sprintf("/b3/COTAHIST_A%d.ZIP", year))); n != 1 {
			t.Fatalf("requests of the file of %d = %d", year, n)
		}
	}

	if daily := filter(got, "/b3/COTAHIST_D"); len(daily) != 0 {
		t.Fatalf("daily files of b3_cotahist = %v", daily)
	}

	if n := len(filter(got, "/b3c/api/download/requestname")); n != 22 {
		t.Fatalf("requests of b3_consolidated = %d", n)
	}

	assertRows(
		t,
		h.Rows(
			"SELECT date::text, trim_scale(value)::text, source FROM marketdata_price WHERE instrument = 'PETR4' ORDER BY date",
		),
		"2021-11-10 29 b3_cotahist",
		"2022-06-15 30.1 b3_cotahist",
		"2023-03-01 25.12 b3_cotahist",
		"2024-12-30 36.99 b3_cotahist",
		"2025-07-01 31.5 b3_cotahist",
		"2026-11-06 32.45 b3_cotahist",
	)
	assertRows(t, historyRow(h, "b3_consolidated", "PETR4"), "2021-11-09 true ")
}

// A222 MQ7: defining a security requests its history from the enabled sources that quote it.
func TestDefineRequestsHistory(t *testing.T) {
	t.Parallel()

	f := &feedServer{}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-11-01"),
		apitest.PriceFeeds([]string{"b3_cotahist"}, feedURLs(srv)),
	)

	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	assertRows(t, historyRow(h, "b3_cotahist", "MXRF11"), "2021-11-01 false ")
	assertRows(t, historyRow(h, "bcb_ptax", "MXRF11"))

	h.MustDo(
		http.MethodPatch,
		"/api/v1/instruments/MXRF11",
		map[string]any{"name": "Maxi Renda", "exchange": "BVMF"},
		http.StatusOK,
		nil,
	)

	assertRows(t, historyRow(h, "b3_cotahist", "MXRF11"), "2021-11-01 false ")
}

// A222 MQ10: a request wakes RunFeeds without waiting for the interval.
func TestHistoryRequestStartsTick(t *testing.T) {
	t.Parallel()

	h, p := ptaxHarness(t)
	p.hold()

	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()

	done := make(chan struct{})
	go func() {
		h.App.Marketdata.RunFeeds(ctx, time.Hour)
		close(done)
	}()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 false ")

	select {
	case <-p.seen:
	case <-ctx.Done():
		t.Fatal("no request of the history reached the source")
	}

	p.release()
	cancel()
	<-done
}

// A222 MQ5, MQ8, S361: a later start changes nothing, an earlier one queues the history again.
func TestS361LowerFromOnly(t *testing.T) {
	t.Parallel()

	h, _ := ptaxHarness(t)
	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/bcb_ptax",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)
	h.App.Marketdata.TickFeeds(t.Context())

	h.MustDo(
		http.MethodPost,
		"/api/v1/instruments/USD/history",
		map[string]string{"from": "2010-01-01"},
		http.StatusAccepted,
		nil,
	)

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2006-11-09 true ")

	h.MustDo(
		http.MethodPost,
		"/api/v1/instruments/USD/history",
		map[string]string{"from": "2000-01-01"},
		http.StatusAccepted,
		nil,
	)

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2000-01-01 false ")
}

// A222 MQ8, S362: a request needs an enabled source and a valid start.
func TestS362NoSource(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	r := h.Do(
		http.MethodPost,
		"/api/v1/instruments/MXRF11/history",
		map[string]string{"from": "2020-01-01"},
	)
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "no_source", "")

	h, _ = seededPTAXHarness(t, "2026-11-09")
	path := "/api/v1/instruments/USD/history"

	h.ExpectProblem(
		h.Do(http.MethodPost, path, map[string]string{"from": "1899-12-31"}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"from",
	)
	h.ExpectProblem(
		h.Do(http.MethodPost, path, map[string]string{"from": "2026-11-10"}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"from",
	)
	h.ExpectProblem(
		h.Do(
			http.MethodPost,
			"/api/v1/instruments/NOPE/history",
			map[string]string{"from": "2020-01-01"},
		),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

// A222 MQ8: requesting history writes to the instance's market data, a writer role.
func TestRequestHistoryRoles(t *testing.T) {
	t.Parallel()

	h, _ := seededPTAXHarness(t, "2026-11-09")
	path := "/api/v1/instruments/USD/history"
	body := map[string]string{"from": "2020-01-01"}

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectProblem(
		h.Call(reader, http.MethodPost, path, body),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	if r := h.Call(writer, http.MethodPost, path, body); r.Status != http.StatusAccepted {
		t.Fatalf("writer status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodPost, path, body),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

// A248 CQ4a, S556: a history request that starts after an older stored price is fetched, because
// its end is the day before the earliest price on or after its start.
func TestS556HistoryRefillsAfterAnOlderPrice(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cb/products/ETH-USD/candles" {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write([]byte(coinbaseETH))
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t,
		apitest.Clock(func() time.Time { return time.Date(2026, 12, 20, 12, 0, 0, 0, time.UTC) }),
		apitest.PriceFeeds(nil, map[string]string{"coinbase": srv.URL + "/cb"}))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "ETH", "type": "crypto", "scale": 8, "name": "Ether", "quote_currency": "USD",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/coinbase",
		map[string]any{"enabled": true}, http.StatusOK, nil)

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, coinbaseETHDates(h), "2026-11-07", "2026-11-08", "2026-11-09")

	for _, statement := range []string{
		`DELETE FROM marketdata_price
		WHERE source = 'coinbase' AND instrument = 'ETH' AND date >= '2026-11-08'`,
		`INSERT INTO marketdata_history (source, instrument, from_date, requested_at)
		VALUES ('coinbase', 'ETH', '2026-11-08', now())
		ON CONFLICT (source, instrument) DO UPDATE
		SET from_date = EXCLUDED.from_date, requested_at = EXCLUDED.requested_at,
			done_at = NULL, error = NULL`,
	} {
		if _, err := h.Pool.Exec(t.Context(), statement); err != nil {
			t.Fatal(err)
		}
	}

	assertRows(t, coinbaseETHDates(h), "2026-11-07")

	h.App.Marketdata.TickFeeds(t.Context())

	want := []priceAPI{
		{"ETH", "USD", "2026-11-07", "3001.5", "coinbase"},
		{"ETH", "USD", "2026-11-08", "3050.12", "coinbase"},
		{"ETH", "USD", "2026-11-09", "3088.45", "coinbase"},
	}
	requirePrices(t, cryptoPrices(t, h, "ETH", "USD"), want)
	assertRows(t, historyRow(h, "coinbase", "ETH"), "2026-11-08 true ")
}

// S655: a history request fills a hole between stored prices of its source, and a request for a
// finished row queues it again (A248 CQ4b). The source answers a candle for every day asked.
func TestS655HistoryFillsAHole(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(everyDayCandles(r)))
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t,
		apitest.Clock(func() time.Time { return time.Date(2027, 1, 10, 12, 0, 0, 0, time.UTC) }),
		apitest.PriceFeeds(nil, map[string]string{"coinbase": srv.URL + "/cb"}))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "ETH", "type": "crypto", "scale": 8, "name": "Ether", "quote_currency": "USD",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/coinbase",
		map[string]any{"enabled": true}, http.StatusOK, nil)

	// Stored: October 1 to 3 and December 20 to January 9, a finished history from October 1.
	for _, statement := range []string{
		`DELETE FROM marketdata_price WHERE instrument = 'ETH'`,
		`INSERT INTO marketdata_price
			(instrument, quote_instrument, date, value, source, priority, recorded_at)
		SELECT 'ETH', 'USD', d::date, 1000, 'coinbase', 3, now()
		FROM generate_series('2026-10-01'::date, '2026-10-03'::date, '1 day') d
		UNION ALL
		SELECT 'ETH', 'USD', d::date, 1000, 'coinbase', 3, now()
		FROM generate_series('2026-12-20'::date, '2027-01-09'::date, '1 day') d`,
		`INSERT INTO marketdata_history (source, instrument, from_date, requested_at, done_at)
		VALUES ('coinbase', 'ETH', '2026-10-01', now(), now())
		ON CONFLICT (source, instrument) DO UPDATE
		SET from_date = EXCLUDED.from_date, done_at = EXCLUDED.done_at, error = NULL`,
	} {
		if _, err := h.Pool.Exec(t.Context(), statement); err != nil {
			t.Fatal(err)
		}
	}

	h.MustDo(http.MethodPost, "/api/v1/instruments/ETH/history",
		map[string]any{"from": "2026-10-01"}, http.StatusAccepted, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	// The hole from October 4 to December 19 holds a price for every day of it.
	assertRows(t, h.Rows(`SELECT count(*)::text FROM marketdata_price
		WHERE source = 'coinbase' AND instrument = 'ETH'
		AND date BETWEEN '2026-10-04' AND '2026-12-19'`), "77")
	assertRows(t, historyRow(h, "coinbase", "ETH"), "2026-10-01 true ")
}

// everyDayCandles answers a Coinbase candle for each day from start to end of the request.
func everyDayCandles(r *http.Request) string {
	start, _ := strconv.ParseInt(r.URL.Query().Get("start"), 10, 64)
	end, _ := strconv.ParseInt(r.URL.Query().Get("end"), 10, 64)

	var candles []string

	for day := start - start%86400; day <= end; day += 86400 {
		candles = append(candles, fmt.Sprintf(
			`{"start":"%d","low":"1","high":"2","open":"1","close":"2000","volume":"1"}`, day))
	}

	return `{"candles":[` + strings.Join(candles, ",") + `]}`
}

// ptaxHarness runs an instance whose PTAX source answers the fixture of S357.
func ptaxHarness(t *testing.T) (*apitest.Harness, *ptaxFixture) {
	t.Helper()

	p := newPTAXFixture(t)
	srv := httptest.NewServer(p)
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(nil, map[string]string{"bcb_ptax": srv.URL + "/ptax"}),
	)

	return h, p
}

// seededPTAXHarness runs an instance whose seed enables bcb_ptax, so nothing requests history.
func seededPTAXHarness(t *testing.T, today string) (*apitest.Harness, *ptaxFixture) {
	t.Helper()

	p := newPTAXFixture(t)
	srv := httptest.NewServer(p)
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today(today),
		apitest.PriceFeeds([]string{"bcb_ptax"}, map[string]string{"bcb_ptax": srv.URL + "/ptax"}),
	)

	return h, p
}

func usdCount(h *apitest.Harness, extra string) []string {
	return h.Rows(
		"SELECT count(*) FROM marketdata_price WHERE source = 'bcb_ptax' AND instrument = 'USD'" + extra,
	)
}

func historyRow(h *apitest.Harness, source, instrument string) []string {
	return h.Rows(
		"SELECT from_date::text, done_at IS NOT NULL, coalesce(error, '') FROM marketdata_history WHERE source = $1 AND instrument = $2",
		source,
		instrument,
	)
}

func coinbaseETHDates(h *apitest.Harness) []string {
	return h.Rows(
		`SELECT date::text FROM marketdata_price
		WHERE source = 'coinbase' AND instrument = 'ETH' ORDER BY date`,
	)
}

func assertRows(t *testing.T, got []string, want ...string) {
	t.Helper()

	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("rows = %q, want %q", got, want)
	}
}

// ptaxFixture answers the BCB PTAX range for USD from testdata/ptax-usd-2021-2026.json (D27).
type ptaxFixture struct {
	items []ptaxItem

	mu       sync.Mutex
	requests []string
	fail     string // a first day (MM-DD-YYYY) answered with 500 while set
	gate     chan struct{}
	seen     chan struct{}
	seenOnce sync.Once
}

type ptaxItem struct {
	Rate float64 `json:"cotacaoVenda"`
	At   string  `json:"dataHoraCotacao"`
	Kind string  `json:"tipoBoletim"`
}

func newPTAXFixture(t *testing.T) *ptaxFixture {
	t.Helper()

	raw, err := os.ReadFile("testdata/ptax-usd-2021-2026.json")
	if err != nil {
		t.Fatal(err)
	}

	var doc struct {
		Value []ptaxItem `json:"value"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}

	return &ptaxFixture{items: doc.Value, seen: make(chan struct{})}
}

func (p *ptaxFixture) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	first := strings.Trim(query.Get("@dataInicial"), "'")

	p.mu.Lock()
	p.requests = append(p.requests, r.URL.RequestURI())
	fail, gate := p.fail, p.gate
	p.mu.Unlock()

	if first == "11-09-2006" {
		p.seenOnce.Do(func() { close(p.seen) })

		if gate != nil {
			select {
			case <-gate:
			case <-r.Context().Done():
				return
			}
		}
	}

	if fail != "" && fail == first {
		http.Error(w, "busy", http.StatusInternalServerError)
		return
	}

	out := []ptaxItem{}

	if strings.Trim(query.Get("@moeda"), "'") == "USD" {
		from, _ := time.Parse("01-02-2006", first)
		to, _ := time.Parse("01-02-2006", strings.Trim(query.Get("@dataFinalCotacao"), "'"))

		for _, it := range p.items {
			day, _ := time.Parse(time.DateOnly, it.At[:10])
			if !day.Before(from) && !day.After(to) {
				out = append(out, it)
			}
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"value": out})
}

func (p *ptaxFixture) setFail(day string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.fail = day
}

// hold makes the request of the first window of S357 wait until release.
func (p *ptaxFixture) hold() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.gate = make(chan struct{})
}

func (p *ptaxFixture) release() {
	p.mu.Lock()
	defer p.mu.Unlock()

	close(p.gate)
}

func (p *ptaxFixture) take() []string {
	p.mu.Lock()
	defer p.mu.Unlock()

	out := p.requests
	p.requests = nil

	return out
}

func (p *ptaxFixture) requestsWith(part string) []string {
	p.mu.Lock()
	defer p.mu.Unlock()

	var out []string

	for _, r := range p.requests {
		if strings.Contains(r, part) {
			out = append(out, r)
		}
	}

	return out
}

// b3Fake serves COTAHIST year files under /b3 and refuses every daily request of b3_consolidated.
type b3Fake struct {
	years map[string][]byte

	mu       sync.Mutex
	requests []string
}

func (b *b3Fake) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b.mu.Lock()
	b.requests = append(b.requests, r.URL.Path)
	b.mu.Unlock()

	if strings.HasPrefix(r.URL.Path, "/b3c/") {
		http.Error(w, "refused", http.StatusBadRequest)
		return
	}

	year := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/b3/COTAHIST_A"), ".ZIP")

	body, ok := b.years[year]
	if !ok {
		http.NotFound(w, r)
		return
	}

	_, _ = w.Write(body)
}

func (b *b3Fake) take() []string {
	b.mu.Lock()
	defer b.mu.Unlock()

	out := b.requests
	b.requests = nil

	return out
}

// cotahistRecord builds a 245-byte type 01 record of the B3 layout (SeriesHistoricas_Layout).
func cotahistRecord(date, ticker, market string, close int64) string {
	r := fmt.Sprintf(
		"01%s02%-12s%s%-12s%-10s%-3s%-4s",
		date,
		ticker,
		market,
		"NAME",
		"CI",
		"",
		"R$",
	)
	r += fmt.Sprintf("%013d%013d%013d%013d%013d", close, close, close, close, close)

	return r + strings.Repeat("0", 245-len(r))
}

// yearFile compresses a COTAHIST year file: header, records, trailer.
func yearFile(year string, records ...string) []byte {
	header := "00COTAHIST." + year + "BOVESPA " + year + "1231"
	trailer := "99COTAHIST." + year + "BOVESPA " + year + "1231"
	lines := append(
		append([]string{header + strings.Repeat(" ", 245-len(header))}, records...),
		trailer+strings.Repeat(" ", 245-len(trailer)),
	)

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("COTAHIST_A" + year + ".TXT")
	_, _ = w.Write([]byte(strings.Join(lines, "\r\n") + "\r\n"))
	_ = zw.Close()

	return buf.Bytes()
}
