package marketdata_test

import (
	"archive/zip"
	"bytes"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// holeHarness is an instance with PETR4, the Ibovespa of the sessions of 2025-03-03 to 2025-03-07 and
// the prices of 2025-03-03 and 2025-03-07 that b3_cotahist stored, whose year file holds 2025-03-05
// too: 2025-03-04 and 2025-03-06 had no trade.
// The returned function moves the clock to the next day, when the check runs again.
func holeHarness(t *testing.T) (*apitest.Harness, *b3Fake, func()) {
	t.Helper()

	b := &b3Fake{years: map[string][]byte{"2025": yearFile(
		"2025",
		cotahistRecord("20250303", "PETR4", "010", 3600),
		cotahistRecord("20250305", "PETR4", "010", 3650),
		cotahistRecord("20250307", "PETR4", "010", 3700),
	)}}
	srv := httptest.NewServer(b)
	t.Cleanup(srv.Close)

	var days atomic.Int64

	now := func() time.Time {
		return time.Date(2025, time.November, 10+int(days.Load()), 12, 0, 0, 0, time.UTC)
	}

	h := apitest.New(t, apitest.Clock(now), apitest.PriceFeeds(
		[]string{"b3_cotahist"},
		map[string]string{"b3_consolidated": srv.URL + "/b3c", "b3_cotahist": srv.URL + "/b3"},
	))

	seedHoles(t, h, "b3_cotahist")

	return h, b, func() { days.Add(1) }
}

// seedHoles stores PETR4, the five sessions and the prices of source of the first and the last one.
func seedHoles(t *testing.T, h *apitest.Harness, source string) {
	t.Helper()

	execSQL(t, h, `INSERT INTO marketdata_instrument
		(code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('PETR4', 'stock', 0, 'Petrobras PN', 'BRL', 'BVMF')`)
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		SELECT 'ibovespa', d, 0, 'br_ibovespa'
		FROM generate_series('2025-03-03'::date, '2025-03-07', '1 day') d`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority) VALUES
		('PETR4', 'BRL', '2025-03-03', 36, '`+source+`', 3),
		('PETR4', 'BRL', '2025-03-07', 37, '`+source+`', 3)`)
	execSQL(
		t,
		h,
		`INSERT INTO marketdata_history (source, instrument, from_date, requested_at, done_at)
		VALUES ('`+source+`', 'PETR4', '2000-01-01', now(), now())`,
	)
}

func petr4Dates(h *apitest.Harness) []string {
	return h.Rows(`SELECT date::text, value::numeric(10, 2)::text FROM marketdata_price
		WHERE instrument = 'PETR4' ORDER BY date`)
}

func yearRequests(b *b3Fake) int {
	n := 0

	for _, r := range b.take() {
		if strings.HasSuffix(r, "COTAHIST_A2025.ZIP") {
			n++
		}
	}

	return n
}

// S707: a session without a price is filled from the year file of the exchange (PH3, PH4).
func TestS707HoleOfPricesIsFilled(t *testing.T) {
	t.Parallel()

	h, _, _ := holeHarness(t)
	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, petr4Dates(h), "2025-03-03 36.00", "2025-03-05 36.50", "2025-03-07 37.00")
}

// S708: a session that no source holds a price of is recorded, stated in the coverage and not asked
// again, until a price source is enabled (PH5, PH6).
func TestS708SessionWithoutAPriceIsRecordedOnce(t *testing.T) {
	t.Parallel()

	h, b, nextDay := holeHarness(t)
	h.App.Marketdata.TickFeeds(t.Context())

	recorded := func() []string {
		return h.Rows(`SELECT instrument, quote_instrument, date::text
			FROM marketdata_price_hole ORDER BY date`)
	}

	assertRows(t, recorded(), "PETR4 BRL 2025-03-04", "PETR4 BRL 2025-03-06")

	var got struct {
		Coverage struct {
			Missing int `json:"missing"`
		} `json:"coverage"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments/PETR4", nil, http.StatusOK, &got)

	if got.Coverage.Missing != 2 {
		t.Errorf("missing = %d, want 2", got.Coverage.Missing)
	}

	b.take()
	nextDay()
	h.App.Marketdata.TickFeeds(t.Context())

	if n := yearRequests(b); n != 0 {
		t.Errorf("the year file was read %d times again", n)
	}

	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/b3_consolidated",
		map[string]any{"enabled": true}, http.StatusOK, nil)

	assertRows(t, recorded())
}

// PH5: a source that fails leaves nothing recorded, and the next check asks again.
func TestHoleOfAFailedSourceIsAskedAgain(t *testing.T) {
	t.Parallel()

	h, b, nextDay := holeHarness(t)
	year := b.years["2025"]
	b.years["2025"] = []byte("not a ZIP")

	h.App.Marketdata.TickFeeds(t.Context())
	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price_hole`))

	b.years["2025"] = year

	nextDay()
	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, petr4Dates(h), "2025-03-03 36.00", "2025-03-05 36.50", "2025-03-07 37.00")
}

// PH3: without the sessions of the exchange nothing is asked.
func TestHolesNeedTheSessionsOfTheExchange(t *testing.T) {
	t.Parallel()

	h, b, _ := holeHarness(t)
	execSQL(t, h, `DELETE FROM marketdata_index_rate`)

	h.App.Marketdata.TickFeeds(t.Context())

	if n := yearRequests(b); n != 0 {
		t.Errorf("the year file was read %d times", n)
	}
}

// PH2: the base history of an enabled source is requested and fetched by the next tick: 20 years, and
// from the B3 no earlier than the year before the first price of any source.
func TestBaseHistoryIsRequested(t *testing.T) {
	t.Parallel()

	h, _, _ := holeHarness(t)
	execSQL(t, h, `UPDATE marketdata_history SET from_date = '2025-03-01'`)

	h.App.Marketdata.TickFeeds(t.Context())
	assertRows(t, historyRow(h, "b3_cotahist", "PETR4"), "2024-03-03 false ")

	h.App.Marketdata.TickFeeds(t.Context())
	assertRows(t, historyRow(h, "b3_cotahist", "PETR4"), "2024-03-03 true ")
}

// PH3: the sessions of a currency quoted in reais are the days of the dollar index: a closing quote
// missing on one of them is fetched from the BCB.
func TestHoleOfACurrencyIsFilled(t *testing.T) {
	t.Parallel()

	h, _ := seededPTAXHarness(t, "2026-11-09")
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		SELECT 'usd_brl', d, 0, 'br_ptax_usd'
		FROM generate_series('2026-10-19'::date, '2026-10-23', '1 day') d`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority) VALUES
		('USD', 'BRL', '2026-10-19', 5, 'bcb_ptax', 3),
		('USD', 'BRL', '2026-11-06', 5, 'bcb_ptax', 3)`)
	execSQL(
		t,
		h,
		`INSERT INTO marketdata_history (source, instrument, from_date, requested_at, done_at)
		VALUES ('bcb_ptax', 'USD', '2000-01-01', now(), now())`,
	)

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price
		WHERE instrument = 'USD' AND date BETWEEN '2026-10-19' AND '2026-10-23' ORDER BY date`),
		"2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23")
}

// PH4: the question of a past year ends on its last hole, so no daily file of that year is asked of a
// source that no longer keeps it: the 22 weekdays of the window of the tick are all it is asked for.
func TestHolesOfAPastYearAskNoDailyFile(t *testing.T) {
	t.Parallel()

	b := &b3Fake{years: map[string][]byte{"2025": yearFile(
		"2025",
		cotahistRecord("20250305", "PETR4", "010", 3650),
		cotahistRecord("20250306", "VALE3", "010", 6100),
	)}}
	srv := httptest.NewServer(b)
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2027-06-01"), apitest.PriceFeeds(
		[]string{"b3_consolidated"},
		map[string]string{"b3_consolidated": srv.URL + "/b3c", "b3_cotahist": srv.URL + "/b3"},
	))
	seedHoles(t, h, "b3_consolidated")

	h.App.Marketdata.TickFeeds(t.Context())

	days := 0

	for _, r := range b.take() {
		if strings.HasPrefix(r, "/b3c/") {
			days++
		}
	}

	if days != 22 {
		t.Errorf("daily files asked = %d, want 22", days)
	}

	assertRows(t, petr4Dates(h), "2025-03-03 36.00", "2025-03-05 36.50", "2025-03-07 37.00")
}

// S709: a session with a trade of PETR4 and none of VALE3 in the file of the exchange had no trade of
// VALE3: it is recorded as such and is no missing price (PH5, PH6).
func TestS709SessionWithoutATrade(t *testing.T) {
	t.Parallel()

	h, b, _ := holeHarness(t)
	b.years["2025"] = yearFile(
		"2025",
		cotahistRecord("20250303", "PETR4", "010", 3600),
		cotahistRecord("20250303", "VALE3", "010", 6000),
		cotahistRecord("20250304", "PETR4", "010", 3610),
		cotahistRecord("20250307", "PETR4", "010", 3700),
		cotahistRecord("20250307", "VALE3", "010", 6100),
	)

	execSQL(t, h, `INSERT INTO marketdata_instrument
		(code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('VALE3', 'stock', 0, 'Vale ON', 'BRL', 'BVMF')`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority) VALUES
		('VALE3', 'BRL', '2025-03-03', 60, 'b3_cotahist', 3),
		('VALE3', 'BRL', '2025-03-07', 61, 'b3_cotahist', 3)`)
	execSQL(
		t,
		h,
		`INSERT INTO marketdata_history (source, instrument, from_date, requested_at, done_at)
		VALUES ('b3_cotahist', 'VALE3', '2000-01-01', now(), now())`,
	)

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, h.Rows(`SELECT date::text, no_trade FROM marketdata_price_hole
		WHERE instrument = 'VALE3' ORDER BY date`),
		"2025-03-04 true", "2025-03-05 false", "2025-03-06 false")

	var got struct {
		Coverage struct {
			Missing int `json:"missing"`
		} `json:"coverage"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments/VALE3", nil, http.StatusOK, &got)

	if got.Coverage.Missing != 2 {
		t.Errorf("missing = %d, want the 2 sessions the file does not hold", got.Coverage.Missing)
	}

	// The quote of the witness is not stored for a pair that did not ask for it.
	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price WHERE instrument = 'PETR4'
		AND date = '2025-03-04'`), "2025-03-04")
}

// reportServer answers the simplified price report of the sessions of files, by "SPRE" and date.
func reportServer(t *testing.T, files map[string]string) (*httptest.Server, func() []string) {
	t.Helper()

	var (
		mu    sync.Mutex
		asked []string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimSuffix(r.URL.Query().Get("filelist"), ".zip,")

		mu.Lock()

		asked = append(asked, name)

		mu.Unlock()

		var outer, inner bytes.Buffer

		zw := zip.NewWriter(&outer)

		if body, ok := files[name]; ok {
			in := zip.NewWriter(&inner)
			f, _ := in.Create("report.xml")
			_, _ = f.Write([]byte(body))
			_ = in.Close()

			g, _ := zw.Create(name + ".zip")
			_, _ = g.Write(inner.Bytes())
		}

		_ = zw.Close()
		_, _ = w.Write(outer.Bytes())
	}))
	t.Cleanup(srv.Close)

	return srv, func() []string {
		mu.Lock()
		defer mu.Unlock()

		return slices.Clone(asked)
	}
}

// priceReport is a report with the last price of each code, given as "CODE value" pairs.
func priceReport(date string, rows ...string) string {
	var b strings.Builder

	for _, row := range rows {
		code, value, _ := strings.Cut(row, " ")
		b.WriteString(`<PricRpt><TradDt><Dt>` + date + `</Dt></TradDt><TckrSymb>` + code +
			`</TckrSymb><LastPric Ccy="BRL">` + value + `</LastPric></PricRpt>`)
	}

	return "<Document>" + b.String() + "</Document>"
}

// S710: the holes of a security the year files omit are asked day by day of the price report: the
// prices it holds are stored, a session without a trade is recorded as one, and each day is asked once
// (PH4, PH5).
func TestS710HolesFilledByThePriceReport(t *testing.T) {
	t.Parallel()

	srv, asked := reportServer(t, map[string]string{
		"SPRE250304": priceReport("2025-03-04", "PETR4 36.1", "IMAB11 98"),
		"SPRE250305": priceReport("2025-03-05", "PETR4 36.5"),
		"SPRE250306": priceReport("2025-03-06", "PETR4 36.6", "IMAB11 98.2"),
	})
	h := apitest.New(t, apitest.Today("2026-11-10"), apitest.PriceFeeds(
		[]string{"b3_price_report"},
		map[string]string{"b3_price_report": srv.URL},
	))
	execSQL(t, h, `INSERT INTO marketdata_instrument
		(code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('IMAB11', 'etf', 0, 'IMA-B', 'BRL', 'BVMF')`)
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		SELECT 'ibovespa', d, 0, 'br_ibovespa'
		FROM generate_series('2025-03-03'::date, '2025-03-06', '1 day') d`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority) VALUES
		('IMAB11', 'BRL', '2025-03-03', 97, 'yahoo_chart', 5),
		('IMAB11', 'BRL', '2026-11-09', 110, 'b3_price_report', 3)`)

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(
		t,
		h.Rows(`SELECT date::text, value::numeric(10, 2)::text, source FROM marketdata_price
		WHERE instrument = 'IMAB11' AND date BETWEEN '2025-03-04' AND '2025-03-06' ORDER BY date`),
		"2025-03-04 98.00 b3_price_report",
		"2025-03-06 98.20 b3_price_report",
	)
	assertRows(
		t,
		h.Rows(`SELECT date::text, no_trade FROM marketdata_price_hole`),
		"2025-03-05 true",
	)

	counts := make(map[string]int)
	for _, name := range asked() {
		counts[name]++
	}

	for _, name := range []string{"SPRE250304", "SPRE250305", "SPRE250306"} {
		if counts[name] != 1 {
			t.Errorf("%s asked %d times, want 1", name, counts[name])
		}
	}

	if counts["SPRE250303"]+counts["SPRE250307"] != 0 {
		t.Errorf("asked days without a hole: %v", counts)
	}
}

// PH4: three failing days in a row end the questions of a check, nothing of them is recorded and the
// next tick asks again.
func TestHolesOfAFailingPriceReportWait(t *testing.T) {
	t.Parallel()

	var asked []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if name := r.URL.Query().Get("filelist"); name != "" {
			asked = append(asked, name)
		}

		http.Error(w, "busy", http.StatusGatewayTimeout)
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2026-11-10"), apitest.PriceFeeds(
		[]string{"b3_price_report"},
		map[string]string{"b3_price_report": srv.URL},
	))
	seedHoles(t, h, "b3_price_report")
	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('ibovespa', '2025-02-28', 0, 'br_ibovespa')`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority)
		VALUES ('PETR4', 'BRL', '2025-02-27', 36, 'b3_price_report', 3)`)

	h.App.Marketdata.TickFeeds(t.Context())

	// One request of the tick and three of the check, of the four holes.
	if len(asked) != 4 {
		t.Errorf("asked = %v, want 4 files", asked)
	}

	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price_hole`))

	asked = nil

	h.App.Marketdata.TickFeeds(t.Context())

	if len(asked) != 4 {
		t.Errorf("asked by the next tick = %v, want 4 files", asked)
	}
}

// PH4: a failing day does not end the questions: the other days are stored and recorded, and the next
// tick asks the failing one alone.
func TestHoleOfAFailingDayIsAskedAlone(t *testing.T) {
	t.Parallel()

	files := map[string]string{
		"SPRE250304": priceReport("2025-03-04", "PETR4 36.1"),
		"SPRE250305": "busy",
		"SPRE250306": priceReport("2025-03-06", "VALE3 60"),
	}
	srv, asked := reportServer(t, files)

	h := apitest.New(t, apitest.Today("2026-11-10"), apitest.PriceFeeds(
		[]string{"b3_price_report"},
		map[string]string{"b3_price_report": srv.URL},
	))
	seedHoles(t, h, "b3_price_report")

	h.App.Marketdata.TickFeeds(t.Context())

	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price WHERE date = '2025-03-04'`),
		"2025-03-04")
	assertRows(t, h.Rows(`SELECT date::text FROM marketdata_price_hole`), "2025-03-06")

	before := len(asked())

	h.App.Marketdata.TickFeeds(t.Context())

	var old []string

	for _, name := range asked()[before:] {
		if strings.HasPrefix(name, "SPRE25") {
			old = append(old, name)
		}
	}

	if !slices.Equal(old, []string{"SPRE250305"}) {
		t.Errorf("asked by the next tick = %v, want the failing day alone", old)
	}
}

// PH2, PH4: while b3_cotahist is enabled, b3_consolidated does not read its year files again.
func TestYearFilesAreReadOnce(t *testing.T) {
	t.Parallel()

	h, b, _ := holeHarness(t)
	execSQL(t, h, `INSERT INTO marketdata_feed (id, enabled) VALUES
		('b3_cotahist', true), ('b3_consolidated', true)`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority)
		VALUES ('PETR4', 'BRL', '2025-11-03', 38, 'b3_consolidated', 3)`)

	h.App.Marketdata.TickFeeds(t.Context())

	if n := yearRequests(b); n != 1 {
		t.Errorf("the year file was read %d times, want 1", n)
	}
}
