package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

// PH2: the base history of 20 years of an enabled source is requested and fetched by the next tick.
func TestBaseHistoryIsRequested(t *testing.T) {
	t.Parallel()

	h, _, _ := holeHarness(t)
	execSQL(t, h, `UPDATE marketdata_history SET from_date = '2025-03-01'`)

	h.App.Marketdata.TickFeeds(t.Context())
	assertRows(t, historyRow(h, "b3_cotahist", "PETR4"), "2005-11-10 false ")

	h.App.Marketdata.TickFeeds(t.Context())
	assertRows(t, historyRow(h, "b3_cotahist", "PETR4"), "2005-11-10 true ")
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
