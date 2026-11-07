package portfolio_test

import (
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// cdiDays are the six CDI business days of 2026-01-02 to 2026-01-09, at 0.055131 percent a day.
var cdiDays = []string{"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"}

type comparedReturn struct {
	Profile   string `json:"profile"`
	PeriodBP  *int   `json:"period_bp"`
	Inflation *struct {
		Index    string `json:"index"`
		From     string `json:"from"`
		Until    string `json:"until"`
		IndexBP  int    `json:"index_bp"`
		ReturnBP int    `json:"return_bp"`
		RealBP   int    `json:"real_bp"`
	} `json:"inflation"`
	Benchmark *struct {
		Index     string `json:"index"`
		From      string `json:"from"`
		Until     string `json:"until"`
		ReturnBP  *int   `json:"return_bp"`
		IndexBP   int    `json:"index_bp"`
		PercentBP *int   `json:"percent_bp"`

		AnnualBP      *int `json:"annual_bp"`
		IndexAnnualBP *int `json:"index_annual_bp"`
		ExcessBP      *int `json:"excess_bp"`
		Days          int  `json:"days"`
	} `json:"benchmark"`
}

// S302: a savings account paid the CDI of each day on its balance earns 100% of CDI.
func TestS302SavingsAtTheCDI(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Profile != "rate" || r.PeriodBP == nil || *r.PeriodBP != 33 || r.Benchmark == nil || r.Inflation != nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.Days != 6 || got.ExcessBP == nil || *got.ExcessBP != 0 {
		t.Fatalf("days and excess = %+v", got)
	}

	if got.Index != "cdi" || got.From != "2026-01-02" || got.Until != "2026-01-09" || got.IndexBP != 33 || got.ReturnBP == nil || *got.ReturnBP != 33 || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}

	// 1.00055131^252 − 1 = 14.90%: the account's rate a year, on the 252 business days of the CDI,
	// equals the CDI's own.
	if got.AnnualBP == nil || *got.AnnualBP != 1490 || got.IndexAnnualBP == nil || *got.IndexAnnualBP != 1490 {
		t.Fatalf("annual = %v, %v", got.AnnualBP, got.IndexAnnualBP)
	}
}

// S303: a deposit inside the period leaves the percent of the CDI unchanged, and the window ends
// at the last stored rate.
func TestS303DepositInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t, "2026-01-06")

	r := b.compared(t, "2026-01-02", "2026-01-12", "")
	if r.PeriodBP == nil || *r.PeriodBP != 33 || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.Until != "2026-01-09" || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S305: an account opened inside the period is compared from the day after its first deposit.
func TestS305AccountOpenedInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2026-01-05")

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.From != "2026-01-06" || got.Until != "2026-01-09" || got.IndexBP != 22 || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S306: a brokerage that holds a stock is a market profile: no rate a year and no percent of the
// CDI, the period return beside the CDI.
func TestS306StockAgainstTheCDI(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	h := b.h
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "PETR4", "type": "stock", "scale": 0, "name": "PETR4", "quote_currency": "BRL", "exchange": "BVMF"}, http.StatusCreated, nil)
	broker := h.Account("Broker", "asset", "brokerage", nil)
	cash := h.Account("Broker cash", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "BRL"})
	petr4 := h.Account("Broker PETR4", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "PETR4"})
	h.Record("2026-01-01", apitest.Posting(b.checking, -30000), apitest.Posting(cash, 30000))
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{"account_id": petr4, "cash_account_id": cash, "side": "buy", "date": "2026-01-01", "quantity": map[string]any{"amount": 10, "currency": "PETR4"}, "unit_price": "30"}, http.StatusCreated, nil)

	for date, price := range map[string]string{"2026-01-01": "30", "2026-01-09": "27"} {
		h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "PETR4", "quote_instrument": "BRL", "date": date, "value": price}, http.StatusCreated, nil)
	}

	b.savings = broker

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Profile != "market" || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.ReturnBP == nil || *got.ReturnBP != -1000 || got.ExcessBP == nil || *got.ExcessBP != -1033 || got.AnnualBP != nil || got.PercentBP != nil || got.IndexAnnualBP == nil {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S307: the days an account held nothing leave the comparison.
func TestS307AccountEmptiedInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookWith(t, "2026-01-01", map[string]int64{"2026-01-06": emptyAll, "2026-01-07": 1_000_000_000})

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.Days != 5 || got.From != "2026-01-02" || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S308: the real return covers the whole months with a stored IPCA.
func TestS308RealReturn(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2025-11-01")

	r := b.compared(t, "2025-11-01", "2026-01-09", "")
	if r.Inflation == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Inflation
	if got.Index != "ipca" || got.From != "2025-11-01" || got.Until != "2025-12-31" || got.IndexBP != 90 || got.ReturnBP != 0 || got.RealBP != -89 {
		t.Fatalf("inflation = %+v", got)
	}
}

// S309: a region without a default index, and a report valued in another currency than the
// index's, carry no comparison and no real return.
func TestS309NoIndexForTheRegionOrCurrency(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2025-11-01")
	b.h.Do(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "USD", "type": "currency", "scale": 2, "name": "Dollar"})
	b.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2025-10-01", "value": "5"}, http.StatusCreated, nil)

	r := b.comparedIn(t, "2025-11-01", "2026-01-09", "USD")
	if r.Benchmark != nil || r.Inflation != nil || r.PeriodBP == nil {
		t.Fatalf("report in USD = %+v", r)
	}

	if _, err := b.h.Pool.Exec(t.Context(), `UPDATE identity_books SET region = 'US'`); err != nil {
		t.Fatal(err)
	}

	r = b.compared(t, "2025-11-01", "2026-01-09", "")
	if r.Benchmark != nil || r.Inflation != nil || r.PeriodBP == nil {
		t.Fatalf("report in region US = %+v", r)
	}
}

// S304: a monthly index and an index without an enabled source are refused on index.
func TestS304IndexRefused(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	for _, index := range []string{"ipca", "sofr"} {
		r := b.h.Do(http.MethodGet, b.query("2026-01-02", "2026-01-09", index), nil)
		if r.Status != http.StatusBadRequest || !strings.Contains(string(r.Body), `"field":"index"`) {
			t.Fatalf("index %s: status %d: %s", index, r.Status, r.Body)
		}
	}
}

// emptyAll in the moves of newBenchmarkBookWith withdraws the whole balance.
const emptyAll = math.MinInt64

type benchmarkBook struct {
	h        *apitest.Harness
	savings  string
	checking string
}

// newBenchmarkBook holds 10,000,000.00 in a savings account from 2026-01-01 and credits on each
// CDI day the rate of the day on the balance of the day before; each date in deposits adds
// 10,000,000.00 from checking after that day's credit.
func newBenchmarkBook(t *testing.T, deposits ...string) benchmarkBook {
	t.Helper()

	return newBenchmarkBookOn(t, "2026-01-01", deposits...)
}

// newBenchmarkBookOn is newBenchmarkBook with the first deposit on opened.
func newBenchmarkBookOn(t *testing.T, opened string, deposits ...string) benchmarkBook {
	t.Helper()

	moves := map[string]int64{}
	for _, d := range deposits {
		moves[d] = 1_000_000_000
	}

	return newBenchmarkBookWith(t, opened, moves)
}

// newBenchmarkBookWith is newBenchmarkBook with the first deposit on opened and, after the credit
// of each date in moves, a transfer of that amount from checking (negative: to checking).
func newBenchmarkBookWith(t *testing.T, opened string, moves map[string]int64) benchmarkBook {
	t.Helper()

	rows := make([]string, len(cdiDays))
	for i, d := range cdiDays {
		day, _ := time.Parse(time.DateOnly, d)
		rows[i] = fmt.Sprintf(`{"data":%q,"valor":"0.055131"}`, day.Format("02/01/2006"))
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/dados/serie/bcdata.sgs.12/dados":
			fmt.Fprint(w, "["+strings.Join(rows, ",")+"]")
		case "/dados/serie/bcdata.sgs.433/dados":
			fmt.Fprint(w, `[{"data":"01/11/2025","valor":"0.50"},{"data":"01/12/2025","valor":"0.40"}]`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	urls := map[string]string{"br_cdi": srv.URL, "br_ipca": srv.URL}
	h := apitest.New(t, apitest.Today("2026-01-12"), apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, urls))
	h.App.Marketdata.TickFeeds(t.Context())

	checking := h.Account("Checking", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	interest := h.Account("Interest", "income", "", nil)

	const deposit = 1_000_000_000

	balance := int64(0)
	if slices.Contains(cdiDays, opened) {
		moves[opened] += deposit
	} else {
		h.Record(opened, apitest.Posting(checking, -deposit), apitest.Posting(savings, deposit))
		balance = deposit
	}

	for _, d := range cdiDays {
		if balance > 0 {
			// 0.055131% of the balance, rounded half up to the cent.
			credit := (balance*55131 + 50_000_000) / 100_000_000
			h.Record(d, apitest.Posting(interest, -credit), apitest.Posting(savings, credit))
			balance += credit
		}

		if move, ok := moves[d]; ok {
			if move == emptyAll {
				move = -balance
			}

			h.Record(d, apitest.Posting(checking, -move), apitest.Posting(savings, move))
			balance += move
		}
	}

	return benchmarkBook{h: h, savings: savings, checking: checking}
}

func (b benchmarkBook) query(from, to, index string) string {
	q := fmt.Sprintf("/api/v1/reports/return?account_id=%s&from=%s&to=%s", b.savings, from, to)
	if index != "" {
		q += "&index=" + index
	}

	return q
}

func (b benchmarkBook) compared(t *testing.T, from, to, index string) comparedReturn {
	t.Helper()

	return b.get(t, b.query(from, to, index))
}

func (b benchmarkBook) comparedIn(t *testing.T, from, to, valueIn string) comparedReturn {
	t.Helper()

	return b.get(t, b.query(from, to, "")+"&value_in="+valueIn)
}

func (b benchmarkBook) get(t *testing.T, query string) comparedReturn {
	t.Helper()
	b.h.Dispatch()

	r := b.h.Do(http.MethodGet, query, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var out comparedReturn
	r.Decode(t, &out)

	return out
}
