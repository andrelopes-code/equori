package portfolio_test

import (
	"fmt"
	"math"
	"math/big"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// cdiDays are the eleven CDI business days of 2026-01-02 to 2026-01-16: with the first credit on
// the second day, a period to 2026-01-16 compares nine days. defaultRate is the CDI of a day in
// units of 1e-8, 0.055131 percent.
var cdiDays = []string{
	"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
	"2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16",
}

// creditDays are the days an explicit book records a yield in S330, S332 and S338: each CDI day
// from 2026-01-05 but 2026-01-07, the day of the transaction under test.
var creditDays = []string{
	"2026-01-05", "2026-01-06", "2026-01-08", "2026-01-09",
	"2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16",
}

const defaultRate = 55131

type excludedPart struct {
	Amount struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Categories []string `json:"categories"`
}

type comparedReturn struct {
	Profile           string  `json:"profile"`
	PeriodBP          *int    `json:"period_bp"`
	Index             *string `json:"index"`
	UnavailableReason string  `json:"unavailable_reason"`
	Excluded          *struct {
		Income  *excludedPart `json:"income"`
		Expense *excludedPart `json:"expense"`
	} `json:"excluded"`
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

		AnnualBP       *int `json:"annual_bp"`
		IndexAnnualBP  *int `json:"index_annual_bp"`
		ExcessBP       *int `json:"excess_bp"`
		PercentErrorBP *int `json:"percent_error_bp"`
		Days           int  `json:"days"`
		Skipped        int  `json:"skipped"`
		Credits        int  `json:"credits"`
		Restarted      bool `json:"restarted"`
		StartedLate    bool `json:"started_late"`
	} `json:"benchmark"`
}

// figures are the numbers of a benchmark; an absent optional number is absent (-1).
type figures struct {
	From, Until                                          string
	Days, Skipped, IndexBP, ReturnBP, ExcessBP           int
	PercentBP, AnnualBP, IndexAnnualBP, Credits, ErrorBP int
	Restarted                                            bool
	Reason                                               string
}

// atTheCDI are the figures of a savings account paid the CDI of each day, from 2026-01-02 to
// 2026-01-16: the first credit (2026-01-05) is A, the last (2026-01-16) is B, and the rates
// compared are those dated in [A, B).
var atTheCDI = figures{
	From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 50, ExcessBP: 0,
	PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 1,
}

// S302: a savings account paid the CDI of each day on its balance earns 100% of CDI. A credit
// observed on day C holds the rate of the day before it, so the rates compared are those in [A, B)
// (R18, R20).
func TestS302SavingsAtTheCDI(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	if r.Profile != "rate" || r.PeriodBP == nil || *r.PeriodBP != 55 || r.Inflation != nil || r.Benchmark == nil || r.Benchmark.Index != "cdi" {
		t.Fatalf("report = %+v", r)
	}

	if got := figuresOf(t, r); got != atTheCDI {
		t.Fatalf("figures = %+v, want %+v", got, atTheCDI)
	}
}

// The comparison starts late when a rate of the period dated before benchmark.from was left
// out, here the rates before the first credit (R21).
func TestStartedLate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		from     string
		wantFrom string
		want     bool
	}{
		{name: "yield recorded after the window opens", from: "2026-01-02", wantFrom: "2026-01-05", want: true},
		{name: "window opens on the first credit", from: "2026-01-05", wantFrom: "2026-01-05", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			b := newBenchmarkBook(t)

			r := b.compared(t, tt.from, "2026-01-09", "")
			if r.Benchmark == nil || r.Benchmark.From != tt.wantFrom {
				t.Fatalf("report = %+v", r)
			}

			if r.Benchmark.StartedLate != tt.want {
				t.Fatalf("started_late = %v, want %v", r.Benchmark.StartedLate, tt.want)
			}
		})
	}
}

// S303: a deposit inside the period leaves the percent of the CDI unchanged, and the window ends
// at the rate before the last credit whatever the end of the period.
func TestS303DepositInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t, "2026-01-06")

	r := b.compared(t, "2026-01-02", "2026-01-20", "")
	if r.PeriodBP == nil || *r.PeriodBP != 55 {
		t.Fatalf("report = %+v", r)
	}

	if got := figuresOf(t, r); got != atTheCDI {
		t.Fatalf("figures = %+v, want %+v", got, atTheCDI)
	}
}

// S305: an account opened inside the period is compared from its first credit, the day after its
// first deposit.
func TestS305AccountOpenedInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2026-01-05")

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	want := figures{
		From: "2026-01-06", Until: "2026-01-15", Days: 8, Skipped: 3, IndexBP: 44, ReturnBP: 44, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 8, ErrorBP: 1,
	}

	if got := figuresOf(t, r); got != want || *r.PeriodBP != 50 {
		t.Fatalf("figures = %+v, want %+v; period %d", got, want, *r.PeriodBP)
	}
}

// S306: a brokerage that holds a stock is a market profile: no rate a year and no percent of the
// CDI, the period return beside the CDI.
func TestS306StockAgainstTheCDI(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	b.stockBrokerage(t, "27")

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Profile != "market" || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.ReturnBP == nil || *got.ReturnBP != -1000 || got.ExcessBP == nil || *got.ExcessBP != -1033 || got.AnnualBP != nil || got.PercentBP != nil || got.IndexAnnualBP == nil {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S307: the days an account held nothing leave the comparison: a rate is compared when the tree
// holds money at the end of its day.
func TestS307AccountEmptiedInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookWith(t, "2026-01-01", map[string]int64{"2026-01-06": emptyAll, "2026-01-07": 1_000_000_000})

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 8, Skipped: 3, IndexBP: 44, ReturnBP: 44, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 8, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 50)
}

// S308: the real return covers the whole months with a stored IPCA.
func TestS308RealReturn(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2025-10-01")
	b.h.Record("2025-10-31", apitest.Posting(b.yield, -100), apitest.Posting(b.savings, 100))

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
// index's, carry no comparison and no real return, each with its reason (R23).
func TestS309NoIndexForTheRegionOrCurrency(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookOn(t, "2025-11-01")
	b.h.Do(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "USD", "type": "currency", "scale": 2, "name": "Dollar"})
	b.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2025-10-01", "value": "5"}, http.StatusCreated, nil)

	r := b.comparedIn(t, "2025-11-01", "2026-01-09", "USD")
	if r.Benchmark != nil || r.Inflation != nil || r.PeriodBP == nil || r.UnavailableReason != "currency_mismatch" {
		t.Fatalf("report in USD = %+v", r)
	}

	if r.Index == nil || *r.Index != "cdi" {
		t.Fatalf("index in USD = %v, want cdi", r.Index)
	}

	if _, err := b.h.Pool.Exec(t.Context(), `UPDATE identity_books SET region = 'US'`); err != nil {
		t.Fatal(err)
	}

	r = b.compared(t, "2025-11-01", "2026-01-09", "")
	if r.Benchmark != nil || r.Inflation != nil || r.PeriodBP == nil || r.UnavailableReason != "no_index_for_region" {
		t.Fatalf("report in region US = %+v", r)
	}

	if r.Index != nil {
		t.Fatalf("index in region US = %q, want none", *r.Index)
	}
}

// S310: a savings account compares the rates after its first recorded yield; with no yield
// recorded there is no comparison and the reason says so (R18, R23).
func TestS310YieldRecordedLate(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookWith(t, "2026-01-01", map[string]int64{"2026-01-05": unrecorded, "2026-01-06": unrecorded})

	want := figures{
		From: "2026-01-07", Until: "2026-01-15", Days: 7, Skipped: 4, IndexBP: 39, ReturnBP: 39, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 7, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 44)

	silent := map[string]int64{}
	for _, d := range cdiDays {
		silent[d] = unrecorded
	}

	r := newBenchmarkBookWith(t, "2026-01-01", silent).compared(t, "2026-01-02", "2026-01-16", "")
	if r.Benchmark != nil || r.PeriodBP == nil || *r.PeriodBP != 0 || r.UnavailableReason != "no_yield_recorded" {
		t.Fatalf("report without a recorded yield = %+v", r)
	}
}

// S311: an account that held money before the period, credited a share of the CDI from its first
// yield, and that receives a deposit, compares the rates in [A, B) over the return of (A, B].
func TestS311YieldOfAHeldAccountRecordedLate(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBookPaying(t, "2025-12-01", 813_594,
		map[string]int64{"2026-01-08": 100_000},
		map[string]int64{
			"2026-01-02": 0, "2026-01-05": 990, "2026-01-06": 990, "2026-01-07": 0, "2026-01-08": 920, "2026-01-09": 920,
			"2026-01-12": 920, "2026-01-13": 920, "2026-01-14": 920, "2026-01-15": 920, "2026-01-16": 920,
		},
	)

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 41, ExcessBP: -9,
		PercentBP: 8255, AnnualBP: 1215, IndexAnnualBP: 1490, Credits: 8, ErrorBP: 11,
	}

	r := b.compared(t, "2025-12-01", "2026-01-16", "")
	requireFigures(t, r, want, 47)

	if r.Profile != "rate" || r.Inflation != nil {
		t.Fatalf("report = %+v", r)
	}
}

// S312: the real return of a stock tree covers the whole months from the first day it held money.
func TestS312RealReturnFromTheFirstHeldDay(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	h := b.h
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "PETR4", "type": "stock", "scale": 0, "name": "PETR4", "quote_currency": "BRL", "exchange": "BVMF"}, http.StatusCreated, nil)
	broker := h.Account("Broker", "asset", "brokerage", nil)
	cash := h.Account("Broker cash", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "BRL"})
	petr4 := h.Account("Broker PETR4", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "PETR4"})
	h.Record("2025-11-15", apitest.Posting(b.checking, -30000), apitest.Posting(cash, 30000))
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{"account_id": petr4, "cash_account_id": cash, "side": "buy", "date": "2025-11-15", "quantity": map[string]any{"amount": 10, "currency": "PETR4"}, "unit_price": "30"}, http.StatusCreated, nil)

	for _, date := range []string{"2025-11-15", "2025-12-31"} {
		h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "PETR4", "quote_instrument": "BRL", "date": date, "value": "30"}, http.StatusCreated, nil)
	}

	b.savings = broker

	r := b.compared(t, "2025-11-01", "2026-01-09", "")
	if r.Profile != "market" || r.Inflation == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Inflation
	if got.Index != "ipca" || got.From != "2025-12-01" || got.Until != "2025-12-31" || got.IndexBP != 40 || got.ReturnBP != 0 || got.RealBP != -40 {
		t.Fatalf("inflation = %+v", got)
	}
}

// S304: a monthly index and an index without an enabled source are refused on index.
func TestS304IndexRefused(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	late := newBenchmarkBookOn(t, "2026-01-09")

	for _, index := range []string{"ipca", "sofr"} {
		r := b.h.Do(http.MethodGet, b.query("2026-01-02", "2026-01-09", index), nil)
		if r.Status != http.StatusBadRequest || !strings.Contains(string(r.Body), `"field":"index"`) {
			t.Fatalf("index %s: status %d: %s", index, r.Status, r.Body)
		}

		// A tree funded on the last day of the period held no money in it: the refusal does not
		// depend on a comparison.
		r = late.h.Do(http.MethodGet, late.query("2026-01-02", "2026-01-09", index), nil)
		if r.Status != http.StatusBadRequest || !strings.Contains(string(r.Body), `"field":"index"`) {
			t.Fatalf("index %s over a tree funded on the last day: status %d: %s", index, r.Status, r.Body)
		}
	}
}

// S313: the credit of from − 1 is A: its rate day is compared though it precedes the period.
func TestS313CreditOnTheDayBeforeThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 1, IndexBP: 50, ReturnBP: 50, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-06", "2026-01-16", ""), want, 50)
}

// S314: a fixed income instrument carries its yield in its price, with no income posting: its tree
// is compared over every day it held money (R18).
func TestS314FixedIncomeInstrument(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	h := b.h
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "CDBX", "type": "fixed_income", "scale": 0, "name": "CDBX", "quote_currency": "BRL"}, http.StatusCreated, nil)
	broker := h.Account("Broker", "asset", "brokerage", nil)
	cash := h.Account("Broker cash", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "BRL"})
	cdb := h.Account("Broker CDBX", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "CDBX"})
	h.Record("2026-01-01", apitest.Posting(b.checking, -100000), apitest.Posting(cash, 100000))
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{"account_id": cdb, "cash_account_id": cash, "side": "buy", "date": "2026-01-01", "quantity": map[string]any{"amount": 100, "currency": "CDBX"}, "unit_price": "10"}, http.StatusCreated, nil)

	for date, price := range map[string]string{"2026-01-01": "10", "2026-01-09": "10.10"} {
		h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "CDBX", "quote_instrument": "BRL", "date": date, "value": price}, http.StatusCreated, nil)
	}

	b.savings = broker

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Profile != "rate" || r.PeriodBP == nil || *r.PeriodBP != 100 || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.From != "2026-01-02" || got.Days != 6 || got.Skipped != 0 || got.IndexBP != 33 || got.ReturnBP == nil || *got.ReturnBP != 100 {
		t.Fatalf("benchmark = %+v", got)
	}

	if got.PercentBP == nil || *got.PercentBP != 30106 || got.AnnualBP == nil || *got.AnnualBP != 5188 {
		t.Fatalf("percent and annual = %v, %v", got.PercentBP, got.AnnualBP)
	}
}

// S315: the real return stops at the first month with a day the tree held no money.
func TestS315RealReturnStopsAtAnEmptiedMonth(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	h := b.h
	savings := h.Account("Savings 2", "asset", "savings", nil)
	h.Record("2025-10-01", apitest.Posting(b.checking, -1_000_000), apitest.Posting(savings, 1_000_000))
	h.Record("2025-10-31", apitest.Posting(b.yield, -100), apitest.Posting(savings, 100))
	h.Record("2025-11-30", apitest.Posting(b.yield, -300), apitest.Posting(savings, 300))
	h.Record("2025-11-30", apitest.Posting(b.checking, 1_000_400), apitest.Posting(savings, -1_000_400))
	h.Record("2026-01-05", apitest.Posting(b.checking, -1_000_000), apitest.Posting(savings, 1_000_000))
	h.Record("2026-01-05", apitest.Posting(b.yield, -200), apitest.Posting(savings, 200))
	h.Record("2026-01-09", apitest.Posting(b.yield, -150), apitest.Posting(savings, 150))

	b.savings = savings

	r := b.compared(t, "2025-11-01", "2026-01-09", "")
	if r.Inflation == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Inflation
	if got.From != "2025-11-01" || got.Until != "2025-11-30" || got.IndexBP != 50 || got.ReturnBP != 3 || got.RealBP != -47 {
		t.Fatalf("inflation = %+v", got)
	}
}

// S316: a purchase paid from the savings is a flow: the percent of the CDI is unchanged and the
// expense is listed as excluded (R19).
func TestS316PurchasePaidFromTheSavings(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{counters: map[string]counter{"2026-01-06": {class: "expense", name: "Shopping", cents: -100_000_000}}})

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, atTheCDI, 55)

	if income, expense := r.excludedText(); income != "" || expense != "100000000 BRL Shopping" {
		t.Fatalf("excluded = %q, %q", income, expense)
	}
}

// S317: a cashback booked to a custom income root is a flow, not a yield (R19).
func TestS317CashbackIntoACustomIncomeRoot(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{counters: map[string]counter{"2026-01-06": {class: "income", name: "Cashback", cents: 5_000_000}}})

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, atTheCDI, 55)

	if income, expense := r.excludedText(); income != "5000000 BRL Cashback" || expense != "" {
		t.Fatalf("excluded = %q, %q", income, expense)
	}
}

// S318: credits booked to a custom income root are not a yield; booked under a sub-account of
// Yield they are (R19).
func TestS318CreditsOutsideAndInsideTheYieldAccount(t *testing.T) {
	t.Parallel()

	r := buildBook(t, bookSpec{creditTo: "custom"}).compared(t, "2026-01-02", "2026-01-16", "")
	if r.Benchmark != nil || r.PeriodBP == nil || *r.PeriodBP != 0 || r.UnavailableReason != "no_yield_recorded" {
		t.Fatalf("report with credits in a custom root = %+v", r)
	}

	if income, expense := r.excludedText(); income != "5526797 BRL Interest" || expense != "" {
		t.Fatalf("excluded = %q, %q", income, expense)
	}

	r = buildBook(t, bookSpec{creditTo: "sub"}).compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, atTheCDI, 55)

	if income, expense := r.excludedText(); income != "" || expense != "" {
		t.Fatalf("excluded = %q, %q", income, expense)
	}
}

// S319: an equity adjustment and an opening balance are flows: the period return is present and
// the percent of the CDI is unchanged; neither is income or expense, so nothing is excluded (R19).
func TestS319EquityAdjustmentAndOpeningBalance(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{counters: map[string]counter{
		"2026-01-06": {role: "adjustments", cents: 3_000_000},
		"2026-01-07": {role: "opening_balances", cents: 2_000_000},
	}})

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, atTheCDI, 55)

	if r.Excluded != nil {
		t.Fatalf("excluded = %+v", r.Excluded)
	}
}

// S320: a Taxes-role expense is a flow: the yield is gross (R19).
func TestS320TaxesExpense(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{counters: map[string]counter{"2026-01-06": {role: "taxes", cents: -1_000_000}}})
	_, name := b.system(t, "taxes")

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, atTheCDI, 55)

	if income, expense := r.excludedText(); income != "" || expense != "1000000 BRL "+name {
		t.Fatalf("excluded = %q, %q", income, expense)
	}
}

// S321: one credit in the period leaves no comparison (R20, R23).
func TestS321SingleCredit(t *testing.T) {
	t.Parallel()

	single := map[string]int64{}
	for _, d := range cdiDays {
		if d != "2026-01-09" {
			single[d] = unrecorded
		}
	}

	r := newBenchmarkBookWith(t, "2026-01-01", single).compared(t, "2026-01-02", "2026-01-09", "")
	if r.Benchmark != nil || r.PeriodBP == nil || *r.PeriodBP != 6 || r.UnavailableReason != "single_credit" {
		t.Fatalf("report = %+v", r)
	}
}

// S322: a deposit and the first credit on the same day: the zero-base subperiod contributes 1, so
// the period return stays defined (R20). The yields of 10,000.00 are about 0.1% of the balance a day, 181% of the CDI.
func TestS322DepositAndFirstCreditOnTheSameDay(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{credits: []string{}, empty: true})
	b.h.Record("2026-01-05", apitest.Posting(b.checking, -1_000_000_000), apitest.Posting(b.savings, 1_000_000_000))

	for _, d := range []string{
		"2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
		"2026-01-12", "2026-01-13", "2026-01-14",
	} {
		b.h.Record(d, apitest.Posting(b.yield, -1_000_000), apitest.Posting(b.savings, 1_000_000))
	}

	want := figures{
		From: "2026-01-05", Until: "2026-01-13", Days: 7, Skipped: 2, IndexBP: 39, ReturnBP: 70, ExcessBP: 31,
		PercentBP: 18066, AnnualBP: 2851, IndexAnnualBP: 1490, Credits: 7, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-14", ""), want, 70)
}

// S323: credits every 7 days with a deposit between two of them do not restart the comparison.
func TestS323WeeklyCreditsWithAMidWeekDeposit(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{
		cdi:     weekdays("2026-01-02", "2026-01-23"),
		credits: []string{"2026-01-09", "2026-01-16", "2026-01-23"},
		opened:  "2025-12-31",
		moves:   map[string]int64{"2026-01-12": 1_000_000_000},
	})

	want := figures{
		From: "2026-01-09", Until: "2026-01-22", Days: 10, Skipped: 6, IndexBP: 55, ReturnBP: 55, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 2, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-23", ""), want, 83)
}

// S324: monthly credits with a deposit between two of them restart the comparison at the next
// credit: the credit after a deposit pays on a balance the index days before it did not hold.
func TestS324MonthlyCreditsWithAMidGapDeposit(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{
		cdi:     weekdays("2026-01-02", "2026-03-31"),
		credits: []string{"2026-01-30", "2026-02-27", "2026-03-31"},
		opened:  "2026-01-02",
		moves:   map[string]int64{"2026-02-12": 1_000_000_000},
		today:   "2026-04-01",
	})

	want := figures{
		From: "2026-02-27", Until: "2026-03-30", Days: 22, Skipped: 41, IndexBP: 122, ReturnBP: 122, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 1, ErrorBP: 1, Restarted: true,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-03-31", ""), want, 348)
}

// S349: a monthly credit after a deposit leaves one compared day: the timing of one credit moves
// the percent by a day in the days, so percent_bp and annual_bp are absent, reason too_few_days,
// and the return, the index and the window stay (R22, R23).
func TestS349MonthlyCreditLeavesOneComparedDay(t *testing.T) {
	t.Parallel()

	r := monthlyCreditsBook(t, "2026-03-03").compared(t, "2026-01-02", "2026-03-03", "")
	if r.Benchmark == nil || r.UnavailableReason != "too_few_days" {
		t.Fatalf("report = %+v", r)
	}

	got := figuresOf(t, r)
	want := figures{
		From: "2026-03-02", Until: "2026-03-02", Days: 1, Skipped: 42, IndexBP: 6, ReturnBP: 6, ExcessBP: 0,
		PercentBP: -1, AnnualBP: -1, IndexAnnualBP: 1490, Credits: 1, ErrorBP: 1, Restarted: true,
		Reason: "too_few_days",
	}

	if got != want {
		t.Fatalf("figures = %+v, want %+v", got, want)
	}
}

// S350: four compared days, one fewer than the least that show the percent, leave percent_bp and
// annual_bp absent on a book that pays 100% of the CDI, reason too_few_days (R22, R23).
func TestS350FourComparedDaysHideThePercent(t *testing.T) {
	t.Parallel()

	r := monthlyCreditsBook(t, "2026-03-06").compared(t, "2026-01-02", "2026-03-06", "")
	if r.Benchmark == nil || r.UnavailableReason != "too_few_days" {
		t.Fatalf("report = %+v", r)
	}

	got := figuresOf(t, r)
	want := figures{
		From: "2026-03-02", Until: "2026-03-05", Days: 4, Skipped: 42, IndexBP: 22, ReturnBP: 22, ExcessBP: 0,
		PercentBP: -1, AnnualBP: -1, IndexAnnualBP: 1490, Credits: 1, ErrorBP: 1, Restarted: true,
		Reason: "too_few_days",
	}

	if got != want {
		t.Fatalf("figures = %+v, want %+v", got, want)
	}
}

// S351: five compared days are the least that show the percent (R22).
func TestS351FiveComparedDaysShowThePercent(t *testing.T) {
	t.Parallel()

	r := monthlyCreditsBook(t, "2026-03-09").compared(t, "2026-01-02", "2026-03-09", "")
	if r.Benchmark == nil || r.UnavailableReason != "" {
		t.Fatalf("report = %+v", r)
	}

	got := figuresOf(t, r)
	want := figures{
		From: "2026-03-02", Until: "2026-03-06", Days: 5, Skipped: 42, IndexBP: 28, ReturnBP: 28, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 1, ErrorBP: 1, Restarted: true,
	}

	if got != want {
		t.Fatalf("figures = %+v, want %+v", got, want)
	}
}

// S325: a rate change inside the window: the rates compared are those dated in [A, B), so the
// rate of the day of B stays out.
func TestS325RateChangeInsideTheWindow(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{rates: map[string]int64{
		"2026-01-06": 50_000, "2026-01-07": 50_000, "2026-01-08": 45_000, "2026-01-09": 45_000,
		"2026-01-12": 45_000, "2026-01-13": 45_000, "2026-01-14": 45_000, "2026-01-15": 45_000, "2026-01-16": 45_000,
	}})

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 43, ReturnBP: 43, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1264, IndexAnnualBP: 1264, Credits: 9, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 48)
}

// S326: a small balance: the rounding of each credit to the cent bounds the percent; above 500
// basis points of error the percent and the rate a year are absent (R22).
func TestS326SmallBalance(t *testing.T) {
	t.Parallel()

	mid := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 49, ExcessBP: -1,
		PercentBP: 9949, AnnualBP: 1482, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 228,
	}
	requireFigures(t, buildBook(t, bookSpec{deposit: 40_000}).compared(t, "2026-01-02", "2026-01-16", ""), mid, 55)

	small := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 54, ExcessBP: 4,
		PercentBP: -1, AnnualBP: -1, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 834,
		Reason: "too_small",
	}

	r := buildBook(t, bookSpec{deposit: 10_000}).compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, small, 60)

	if r.UnavailableReason != "too_small" {
		t.Fatalf("reason = %q", r.UnavailableReason)
	}
}

// S327: a dividend paid into a brokerage is income of a security tree: section 4.3 applies, the
// profile is market and no yield is recorded (R19 covers cash trees only).
func TestS327BrokerageWithADividend(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)
	cash := b.stockBrokerage(t, "30")
	dividends := b.h.Account("Dividends", "income", "", nil)
	b.h.Record("2026-01-05", apitest.Posting(cash, 1000), apitest.Posting(dividends, -1000))

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Profile != "market" || r.PeriodBP == nil || *r.PeriodBP != 333 || r.Benchmark == nil || r.Excluded != nil || r.UnavailableReason != "" {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.ReturnBP == nil || *got.ReturnBP != 333 || got.ExcessBP == nil || *got.ExcessBP != 300 || got.Days != 6 || got.PercentBP != nil || got.AnnualBP != nil || got.PercentErrorBP != nil || got.Credits != 0 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S328: a deposit on a Saturday earns from the first business day, as a bank pays it: the flow
// moves to the next day with an index rate, so the credit of that Monday, paid on the balance of
// Friday, is 100% of the CDI (R19).
func TestS328SaturdayDeposit(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{
		cdi:      weekdays("2026-01-02", "2026-01-23"),
		moves:    map[string]int64{"2026-01-10": 1_000_000_000},
		bankPaid: true,
		today:    "2026-01-26",
	})

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-23", ""), saturdayFigures, 83)
}

// S329: a withdrawal on a Saturday leaves the balance the credit of the next Monday pays on at the
// next day with an index rate (R19).
func TestS329SaturdayWithdrawal(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{
		cdi:      weekdays("2026-01-02", "2026-01-23"),
		moves:    map[string]int64{"2026-01-10": -500_000_000},
		bankPaid: true,
		today:    "2026-01-26",
	})

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-23", ""), saturdayFigures, 83)
}

// S330: a transaction that credits a yield to two savings accounts counts, for the tree of one,
// the share of the yield that matches its own amount: the rest is not a flow of the tree (R19).
func TestS330SplitYieldTransaction(t *testing.T) {
	t.Parallel()
	b := explicitBook(t)
	other := b.h.Account("Savings B", "asset", "savings", nil)

	for _, d := range creditDays {
		b.credit(d, 551_310)
	}

	b.h.Record("2026-01-07", apitest.Posting(b.savings, 551_310), apitest.Posting(other, 551_310), apitest.Posting(b.yield, -1_102_620))

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 50, ExcessBP: 0,
		PercentBP: 9973, AnnualBP: 1486, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 55)
}

// S331: a reversal of yield reduces the yield credited and is not a credit date: B is the last
// positive credit (R19, R22).
func TestS331YieldReversal(t *testing.T) {
	t.Parallel()
	b := explicitBook(t)

	for _, d := range []string{
		"2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
		"2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15",
	} {
		b.credit(d, 551_310)
	}

	b.credit("2026-01-16", -100_000)

	want := figures{
		From: "2026-01-05", Until: "2026-01-14", Days: 8, Skipped: 3, IndexBP: 44, ReturnBP: 44, ExcessBP: 0,
		PercentBP: 9975, AnnualBP: 1486, IndexAnnualBP: 1490, Credits: 8, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 49)
}

// S332: a transaction with a yield and a salary: the yield is the credit and the salary is the
// flow and the excluded income (R19).
func TestS332YieldWithSalary(t *testing.T) {
	t.Parallel()
	b := explicitBook(t)

	for _, d := range creditDays {
		b.credit(d, 551_310)
	}

	salary := b.h.Account("Salary", "income", "", nil)
	b.h.Record("2026-01-07", apitest.Posting(b.savings, 100_551_310), apitest.Posting(b.yield, -551_310), apitest.Posting(salary, -100_000_000))

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 46, ExcessBP: -4,
		PercentBP: 9270, AnnualBP: 1374, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 1,
	}

	r := b.compared(t, "2026-01-02", "2026-01-16", "")
	requireFigures(t, r, want, 52)

	if income, expense := r.excludedText(); income != "100000000 BRL Salary" || expense != "" {
		t.Fatalf("excluded = %q, %q", income, expense)
	}
}

// S333: the bound of the percent counts the tree postings of the credits: a credit booked to two
// accounts of the tree rounds twice (R22).
func TestS333CreditOnTwoAccountsOfTheTree(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{credits: []string{}, empty: true})
	first := b.h.Account("Savings first", "asset", "savings", map[string]any{"parent_id": b.savings})
	second := b.h.Account("Savings second", "asset", "savings", map[string]any{"parent_id": b.savings})
	b.h.Record("2026-01-02", apitest.Posting(b.checking, -1_000_000), apitest.Posting(first, 1_000_000))

	for _, d := range []string{
		"2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
		"2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16",
	} {
		b.h.Record(d, apitest.Posting(first, 300), apitest.Posting(second, 251), apitest.Posting(b.yield, -551))
	}

	want := figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: 50, ExcessBP: 0,
		PercentBP: 9967, AnnualBP: 1485, IndexAnnualBP: 1490, Credits: 9, ErrorBP: 19,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 55)
}

// S334: an index with no rate in the compared window leaves no benchmark, reason
// no_rate_in_window (R23).
func TestS334NoRateInTheWindow(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{cdi: []string{"2026-01-02", "2026-01-12"}, credits: []string{}, empty: true})
	b.h.Record("2026-01-02", apitest.Posting(b.checking, -1_000_000_000), apitest.Posting(b.savings, 1_000_000_000))
	b.credit("2026-01-05", 551_310)
	b.credit("2026-01-09", 551_310)

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Benchmark != nil || r.PeriodBP == nil || *r.PeriodBP != 11 || r.UnavailableReason != "no_rate_in_window" {
		t.Fatalf("report = %+v, reason %q", r, r.UnavailableReason)
	}

	if r.Index == nil || *r.Index != "cdi" {
		t.Fatalf("index = %v, want cdi", r.Index)
	}
}

// S335: the index is published a business day after its date. Credits dated after the day that
// follows the last stored rate leave the window, so the return does not run past the rates
// (R20, R23).
func TestS335IndexPublicationLag(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{stored: cdiDays[:7]})

	want := figures{
		From: "2026-01-05", Until: "2026-01-12", Days: 6, Skipped: 1, IndexBP: 33, ReturnBP: 33, ExcessBP: 0,
		PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 6, ErrorBP: 1,
	}

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-16", ""), want, 55)
}

// S336: a weekend inside the lag: the last stored rate is the Friday 2026-01-16 and the credits run
// to the Tuesday 2026-01-20, so B is the credit of the Friday.
func TestS336IndexPublicationLagOverAWeekend(t *testing.T) {
	t.Parallel()

	b := buildBook(t, bookSpec{
		cdi:     weekdays("2026-01-02", "2026-01-20"),
		stored:  cdiDays,
		credits: weekdays("2026-01-05", "2026-01-20"),
		today:   "2026-01-21",
	})

	requireFigures(t, b.compared(t, "2026-01-02", "2026-01-20", ""), atTheCDI, 66)
}

// S337: when no credit after A is dated on or before the day after the last stored rate, the
// benchmark is absent, reason no_rate_in_window: the CDI is stored to 2026-01-05 and the credits
// are those of 2026-01-05, 2026-01-08 and 2026-01-09.
func TestS337NoCreditAfterAWithinTheRates(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{stored: cdiDays[:2], credits: []string{"2026-01-05", "2026-01-08", "2026-01-09"}})

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.Benchmark != nil || r.PeriodBP == nil || *r.PeriodBP != 28 || r.UnavailableReason != "no_rate_in_window" {
		t.Fatalf("report = %+v, reason %q", r, r.UnavailableReason)
	}
}

// S338: the yield of a transaction is allocated to the balance accounts that receive it, in
// proportion to what each receives; the rest of the tree's amount is a flow (R19).
func TestS338YieldShareOfATransaction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		record          func(t *testing.T, b benchmarkBook)
		want            figures
		period          int
		income, expense string
	}{
		{
			name: "tax paid from the yield", record: recordTaxOnTheYield,
			want: dayFigures(50, 0, 10071, 1501), period: 56, expense: "90000 BRL Taxes",
		},
		{
			name: "yield split with another account", record: recordYieldSplitInThirds,
			want: dayFigures(46, -4, 9235, 1369), period: 51,
		},
		{
			name: "yield larger than the amounts received", record: recordYieldAboveWhatIsReceived,
			want: dayFigures(45, -5, 9017, 1334), period: 50,
		},
		{
			name: "yield with a withdrawal from checking", record: recordYieldWithADeposit,
			want: dayFigures(46, -4, 9270, 1374), period: 52,
		},
		{
			name: "expense paid by another account", record: recordUnrelatedExpense,
			want: dayFigures(50, 0, 9973, 1486), period: 55,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			b := explicitBook(t)

			for _, d := range creditDays {
				b.credit(d, 551_310)
			}

			tt.record(t, b)

			r := b.compared(t, "2026-01-02", "2026-01-16", "")
			requireFigures(t, r, tt.want, tt.period)

			if income, expense := r.excludedText(); income != tt.income || expense != tt.expense {
				t.Fatalf("excluded = %q, %q, want %q, %q", income, expense, tt.income, tt.expense)
			}
		})
	}
}

// S338: a transaction whose yield is received only outside the tree credits the tree nothing (R19).
// The tree's amount is a flow and the income and expense postings of the transaction are excluded.
// Hand figures, in the units of the postings:
//   - Y > 0: Yield -100,000, Savings B +105,000, tree -10,000, Taxes +5,000. T+ = 0 and O+ = 105,000,
//     so the credit is 100,000 x 0 / 105,000 = 0 and the flow is -10,000 - 0 = -10,000; the credits
//     of 2026-01-06, 01-08 and 01-09 in (A, B] stay, 3 in all, and Taxes 5,000 is excluded.
//   - Y < 0: Yield +100,000, Savings B -105,000, tree +10,000, Bonus -5,000. The negative postings
//     against the tree sum to 0 and those against Savings B to 105,000, so the credit is 0 and the
//     flow is +10,000; Bonus 5,000 is excluded.
func TestS338YieldReceivedOutsideTheTree(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		record          func(t *testing.T, b benchmarkBook)
		income, expense string
	}{
		{name: "yield", record: recordYieldReceivedOutsideTheTree, expense: "5000 BRL Taxes"},
		{name: "reversal", record: recordReversalPaidOutsideTheTree, income: "5000 BRL Bonus"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			creditedBook := func() benchmarkBook {
				b := explicitBook(t)

				for _, d := range []string{"2026-01-05", "2026-01-06", "2026-01-08", "2026-01-09"} {
					b.credit(d, 551_310)
				}

				return b
			}
			b := creditedBook()
			tt.record(t, b)

			r := b.compared(t, "2026-01-02", "2026-01-09", "")
			if r.Benchmark == nil || r.Benchmark.Credits != 3 {
				t.Fatalf("benchmark = %+v, want 3 credits", r.Benchmark)
			}

			if income, expense := r.excludedText(); income != tt.income || expense != tt.expense {
				t.Fatalf("excluded = %q, %q, want %q, %q", income, expense, tt.income, tt.expense)
			}

			without := creditedBook().compared(t, "2026-01-02", "2026-01-09", "")
			if got, want := figuresOf(t, r), figuresOf(t, without); got != want {
				t.Fatalf("figures = %+v, want those of the book without the transaction %+v", got, want)
			}
		})
	}
}

// S339: a percent that cannot be computed leaves a reason: a rate of 0 inside the window.
func TestS339PercentUndefined(t *testing.T) {
	t.Parallel()
	b := buildBook(t, bookSpec{rates: map[string]int64{"2026-01-06": 0}})

	want := figures{
		From: "2026-01-05", Until: "2026-01-08", Days: 4, Skipped: 2, IndexBP: 17, ReturnBP: 17, ExcessBP: 0,
		PercentBP: -1, AnnualBP: -1, IndexAnnualBP: 1098, Credits: 3, ErrorBP: 1, Reason: "percent_undefined",
	}

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	requireFigures(t, r, want, 22)

	if r.UnavailableReason != "percent_undefined" {
		t.Fatalf("reason = %q", r.UnavailableReason)
	}
}

// dayFigures are the figures of the five cases of S338 with the given return, excess, percent
// and rate a year: the window of atTheCDI, nine days.
func dayFigures(returnBP, excessBP, percentBP, annualBP int) figures {
	return figures{
		From: "2026-01-05", Until: "2026-01-15", Days: 9, Skipped: 2, IndexBP: 50, ReturnBP: returnBP,
		ExcessBP: excessBP, PercentBP: percentBP, AnnualBP: annualBP, IndexAnnualBP: 1490, Credits: 9,
		ErrorBP: 1,
	}
}

// recordTaxOnTheYield records +510,000 to the tree, +90,000 against Taxes and -600,000 against
// Yield on 2026-01-07: the credit is the gross 600,000 and the flow is -90,000.
func recordTaxOnTheYield(t *testing.T, b benchmarkBook) {
	t.Helper()

	id, _ := b.system(t, "taxes")
	b.h.Record("2026-01-07", apitest.Posting(b.savings, 510_000), apitest.Posting(id, 90_000), apitest.Posting(b.yield, -600_000))
}

// recordYieldSplitInThirds records +183,770 to the tree, +367,540 to another savings account and
// -551,310 against Yield: the credit is 183,770 and there is no flow.
func recordYieldSplitInThirds(t *testing.T, b benchmarkBook) {
	t.Helper()

	other := b.h.Account("Savings B", "asset", "savings", nil)
	b.h.Record("2026-01-07", apitest.Posting(b.savings, 183_770), apitest.Posting(other, 367_540), apitest.Posting(b.yield, -551_310))
}

// recordYieldAboveWhatIsReceived records +100,000 to the tree, +100,000 to another savings account,
// -50,000 against checking and -150,000 against Yield: the credit is 75,000 and the flow 25,000.
func recordYieldAboveWhatIsReceived(t *testing.T, b benchmarkBook) {
	t.Helper()

	other := b.h.Account("Savings B", "asset", "savings", nil)
	b.h.Record(
		"2026-01-07",
		apitest.Posting(b.savings, 100_000), apitest.Posting(other, 100_000),
		apitest.Posting(b.checking, -50_000), apitest.Posting(b.yield, -150_000),
	)
}

// recordYieldWithADeposit records +100,551,310 to the tree, -100,000,000 against checking and
// -551,310 against Yield: the credit is 551,310 and the flow 100,000,000.
func recordYieldWithADeposit(t *testing.T, b benchmarkBook) {
	t.Helper()

	b.h.Record("2026-01-07", apitest.Posting(b.savings, 100_551_310), apitest.Posting(b.checking, -100_000_000), apitest.Posting(b.yield, -551_310))
}

// recordUnrelatedExpense records a yield of 551,310 and, in the same transaction, a purchase of
// 30,000 paid from checking: the purchase is not an amount of the tree, so it is not excluded.
func recordUnrelatedExpense(t *testing.T, b benchmarkBook) {
	t.Helper()

	shop := b.h.Account("Groceries", "expense", "", nil)
	b.h.Record(
		"2026-01-07",
		apitest.Posting(b.savings, 551_310), apitest.Posting(b.yield, -551_310),
		apitest.Posting(b.checking, -30_000), apitest.Posting(shop, 30_000),
	)
}

// recordYieldReceivedOutsideTheTree records -10,000 against the tree, +105,000 against another
// savings account, +5,000 against Taxes and -100,000 against Yield: the credit is 0 and the flow
// is -10,000.
func recordYieldReceivedOutsideTheTree(t *testing.T, b benchmarkBook) {
	t.Helper()

	other := b.h.Account("Savings B", "asset", "savings", nil)
	taxes, _ := b.system(t, "taxes")
	b.h.Record(
		"2026-01-07",
		apitest.Posting(b.savings, -10_000), apitest.Posting(other, 105_000),
		apitest.Posting(taxes, 5_000), apitest.Posting(b.yield, -100_000),
	)
}

// recordReversalPaidOutsideTheTree records +10,000 against the tree, -105,000 against another
// savings account, -5,000 against Bonus and +100,000 against Yield: the credit is 0 and the flow
// is +10,000.
func recordReversalPaidOutsideTheTree(t *testing.T, b benchmarkBook) {
	t.Helper()

	other := b.h.Account("Savings B", "asset", "savings", nil)
	bonus := b.h.Account("Bonus", "income", "", nil)
	b.h.Record(
		"2026-01-07",
		apitest.Posting(b.savings, 10_000), apitest.Posting(other, -105_000),
		apitest.Posting(bonus, -5_000), apitest.Posting(b.yield, 100_000),
	)
}

// saturdayFigures are the figures of a savings account paid 100% of the CDI over 2026-01-02 to
// 2026-01-23: the credits of 2026-01-05 to 2026-01-23 bound the rates of 2026-01-05 to 2026-01-22.
var saturdayFigures = figures{
	From: "2026-01-05", Until: "2026-01-22", Days: 14, Skipped: 2, IndexBP: 77, ReturnBP: 77, ExcessBP: 0,
	PercentBP: 10000, AnnualBP: 1490, IndexAnnualBP: 1490, Credits: 14, ErrorBP: 1,
}

// In the moves of newBenchmarkBookWith, emptyAll withdraws the whole balance and unrecorded
// leaves the credit of the day out of the ledger.
const (
	emptyAll   = math.MinInt64
	unrecorded = math.MinInt64 + 1
)

type benchmarkBook struct {
	h        *apitest.Harness
	savings  string
	checking string
	yield    string
}

// counter is a posting against the savings, after the credit of its day, whose other side is the
// system account of role or a new account of class and name.
type counter struct {
	role, class, name string
	cents             int64
}

// bookSpec describes a savings account of a book: the CDI days stored, the days the issuer
// credits, and the moves of its money.
type bookSpec struct {
	cdi, credits []string
	stored       []string // the CDI days the feed publishes; all of cdi when nil
	opened       string
	today        string
	creditTo     string // "custom": an income root; "sub": a sub-account of Yield; "": Yield
	deposit      int64
	empty        bool // no first deposit
	rates        map[string]int64
	moves        map[string]int64
	permille     map[string]int64
	counters     map[string]counter

	// bankPaid makes a move on a day outside cdi join the balance a credit pays on the next CDI
	// day, after that day's credit: a bank pays a deposit from its first business day.
	bankPaid bool
}

// monthlyCreditsBook credits on 2026-01-30, 2026-03-02 and last, with a deposit on 2026-02-12 between
// the first two: the comparison restarts at 2026-03-02.
func monthlyCreditsBook(t *testing.T, last string) benchmarkBook {
	t.Helper()

	return buildBook(t, bookSpec{
		cdi:     weekdays("2026-01-02", "2026-03-31"),
		credits: []string{"2026-01-30", "2026-03-02", last},
		opened:  "2026-01-02",
		moves:   map[string]int64{"2026-02-12": 1_000_000_000},
		today:   "2026-03-10",
	})
}

// newBenchmarkBook holds 10,000,000.00 in a savings account from 2026-01-01 and credits on each
// CDI day, after the first, the CDI of the days since the last credit on its balance; each date in
// deposits adds 10,000,000.00 from checking after that day's credit.
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

	return newBenchmarkBookPaying(t, opened, 1_000_000_000, moves, nil)
}

// newBenchmarkBookPaying is newBenchmarkBookWith with a first deposit of deposit cents and, on each
// credit date in permille, a credit of that many thousandths of the CDI (0 records no credit); a
// date not in permille credits the whole CDI.
func newBenchmarkBookPaying(t *testing.T, opened string, deposit int64, moves, permille map[string]int64) benchmarkBook {
	t.Helper()

	return buildBook(t, bookSpec{opened: opened, deposit: deposit, moves: moves, permille: permille})
}

// buildBook stores the CDI of each day of the spec and records the savings account: a credit on a
// credit date is the CDI of the CDI days since the previous credit, on the balance before it, as
// a share of permille thousandths, rounded half up to the cent (R20).
func buildBook(t *testing.T, s bookSpec) benchmarkBook {
	t.Helper()

	cdi := s.cdi
	if cdi == nil {
		cdi = cdiDays
	}

	credits := s.credits
	if credits == nil {
		credits = cdi
	}

	opened := cmpOr(s.opened, "2026-01-01")
	deposit := cmpOr(s.deposit, 1_000_000_000)
	today := cmpOr(s.today, "2026-01-12")
	rateOf := func(d string) int64 {
		if r, ok := s.rates[d]; ok {
			return r
		}

		return defaultRate
	}

	published := cmpSlice(s.stored, cdi)
	rows := make([]string, len(published))

	for i, d := range published {
		day, _ := time.Parse(time.DateOnly, d)
		r := rateOf(d)
		rows[i] = fmt.Sprintf(`{"data":%q,"valor":"%d.%06d"}`, day.Format("02/01/2006"), r/1_000_000, r%1_000_000)
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
	h := apitest.New(t, apitest.Today(today), apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, urls))
	h.App.Marketdata.TickFeeds(t.Context())

	b := benchmarkBook{h: h}
	b.checking = h.Account("Checking", "asset", "checking", nil)
	b.savings = h.Account("Savings", "asset", "savings", nil)
	b.yield, _ = b.system(t, "yield")

	creditTo := b.yield

	switch s.creditTo {
	case "custom":
		creditTo = h.Account("Interest", "income", "", nil)
	case "sub":
		creditTo = h.Account("Interest", "income", "", map[string]any{"parent_id": b.yield})
	}

	moves := map[string]int64{}
	for d, m := range s.moves {
		moves[d] = m
	}

	days := slices.Concat(cdi, credits)
	for d := range moves {
		days = append(days, d)
	}

	for d := range s.counters {
		days = append(days, d)
	}

	slices.Sort(days)
	days = slices.Compact(days)

	balance, pending := int64(0), int64(0)

	switch {
	case s.empty:
	case slices.Contains(cdi, opened):
		moves[opened] += deposit
	default:
		h.Record(opened, apitest.Posting(b.checking, -deposit), apitest.Posting(b.savings, deposit))
		balance = deposit
	}

	previous := cdi[0]

	for _, d := range days {
		if slices.Contains(credits, d) {
			share := int64(1000)
			if p, ok := s.permille[d]; ok {
				share = p
			}

			if moves[d] == unrecorded {
				share = 0
			}

			span := slices.DeleteFunc(slices.Clone(cdi), func(x string) bool { return x < previous || x >= d })
			if credit := creditOf(balance, span, rateOf, share); balance > 0 && credit > 0 {
				h.Record(d, apitest.Posting(creditTo, -credit), apitest.Posting(b.savings, credit))
				balance += credit
			}

			previous = d
		}

		if slices.Contains(cdi, d) {
			balance += pending
			pending = 0
		}

		if move, ok := moves[d]; ok && move != unrecorded {
			if move == emptyAll {
				move = -balance
			}

			h.Record(d, apitest.Posting(b.checking, -move), apitest.Posting(b.savings, move))

			if s.bankPaid && !slices.Contains(cdi, d) {
				pending += move
			} else {
				balance += move
			}
		}

		if c, ok := s.counters[d]; ok {
			other := b.counterAccount(t, c)
			h.Record(d, apitest.Posting(b.savings, c.cents), apitest.Posting(other, -c.cents))
			balance += c.cents
		}
	}

	return b
}

// explicitBook is a savings account that receives 10,000,000.00 on 2026-01-02 and whose credits
// the test records one by one.
func explicitBook(t *testing.T) benchmarkBook {
	t.Helper()

	b := buildBook(t, bookSpec{credits: []string{}, empty: true})
	b.h.Record("2026-01-02", apitest.Posting(b.checking, -1_000_000_000), apitest.Posting(b.savings, 1_000_000_000))

	return b
}

// credit records a yield of cents against Yield in the savings account.
func (b benchmarkBook) credit(day string, cents int64) {
	b.h.Record(day, apitest.Posting(b.yield, -cents), apitest.Posting(b.savings, cents))
}

// creditOf is share thousandths of balance × (Π(1 + rate) − 1) over the days, rounded half up.
func creditOf(balance int64, days []string, rateOf func(string) int64, share int64) int64 {
	factor := big.NewRat(1, 1)
	for _, d := range days {
		factor.Mul(factor, big.NewRat(100_000_000+rateOf(d), 100_000_000))
	}

	factor.Sub(factor, big.NewRat(1, 1))
	factor.Mul(factor, big.NewRat(balance*share, 1000))
	factor.Add(factor, big.NewRat(1, 2))

	return new(big.Int).Div(factor.Num(), factor.Denom()).Int64()
}

// weekdays lists the days from first to last that are not a Saturday or a Sunday.
func weekdays(first, last string) []string {
	var out []string

	end, _ := time.Parse(time.DateOnly, last)
	for d, _ := time.Parse(time.DateOnly, first); !d.After(end); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Saturday && d.Weekday() != time.Sunday {
			out = append(out, d.Format(time.DateOnly))
		}
	}

	return out
}

// cmpSlice is v, or fallback when v is nil.
func cmpSlice(v, fallback []string) []string {
	if v == nil {
		return fallback
	}

	return v
}

// cmpOr is v, or fallback when v is the zero value.
func cmpOr[T comparable](v, fallback T) T {
	var zero T
	if v == zero {
		return fallback
	}

	return v
}

// system returns the id and the name of the system account of role.
func (b benchmarkBook) system(t *testing.T, role string) (id, name string) {
	t.Helper()

	err := b.h.Pool.QueryRow(t.Context(), `SELECT id::text, name FROM ledger_account WHERE system_role = $1`, role).Scan(&id, &name)
	if err != nil {
		t.Fatalf("system account %s: %v", role, err)
	}

	return id, name
}

func (b benchmarkBook) counterAccount(t *testing.T, c counter) string {
	t.Helper()

	if c.role != "" {
		id, _ := b.system(t, c.role)

		return id
	}

	return b.h.Account(c.name, c.class, "", nil)
}

// stockBrokerage records a brokerage that buys 10 PETR4 at 30.00 on 2026-01-01 with money from
// checking, prices it at 30.00 that day and at last on 2026-01-09, and measures it; it returns
// the cash account.
func (b *benchmarkBook) stockBrokerage(t *testing.T, last string) string {
	t.Helper()

	h := b.h
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "PETR4", "type": "stock", "scale": 0, "name": "PETR4", "quote_currency": "BRL", "exchange": "BVMF"}, http.StatusCreated, nil)
	broker := h.Account("Broker", "asset", "brokerage", nil)
	cash := h.Account("Broker cash", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "BRL"})
	petr4 := h.Account("Broker PETR4", "asset", "brokerage", map[string]any{"parent_id": broker, "currency": "PETR4"})
	h.Record("2026-01-01", apitest.Posting(b.checking, -30000), apitest.Posting(cash, 30000))
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{"account_id": petr4, "cash_account_id": cash, "side": "buy", "date": "2026-01-01", "quantity": map[string]any{"amount": 10, "currency": "PETR4"}, "unit_price": "30"}, http.StatusCreated, nil)

	for date, price := range map[string]string{"2026-01-01": "30", "2026-01-09": last} {
		h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "PETR4", "quote_instrument": "BRL", "date": date, "value": price}, http.StatusCreated, nil)
	}

	b.savings = broker

	return cash
}

func requireFigures(t *testing.T, r comparedReturn, want figures, period int) {
	t.Helper()

	if got := cmpOr(r.PeriodBP, new(-1)); *got != period {
		t.Fatalf("period_bp = %d, want %d", *got, period)
	}

	if got := figuresOf(t, r); got != want {
		t.Fatalf("figures = %+v, want %+v", got, want)
	}
}

func figuresOf(t *testing.T, r comparedReturn) figures {
	t.Helper()

	if r.Benchmark == nil {
		t.Fatalf("no benchmark: %+v", r)
	}

	b := r.Benchmark
	or := func(p *int) int {
		if p == nil {
			return -1
		}

		return *p
	}

	return figures{
		From: b.From, Until: b.Until, Days: b.Days, Skipped: b.Skipped, IndexBP: b.IndexBP, ReturnBP: or(b.ReturnBP),
		ExcessBP: or(b.ExcessBP), PercentBP: or(b.PercentBP), AnnualBP: or(b.AnnualBP), IndexAnnualBP: or(b.IndexAnnualBP),
		Credits: b.Credits, ErrorBP: or(b.PercentErrorBP), Restarted: b.Restarted, Reason: r.UnavailableReason,
	}
}

// excludedText is each excluded total as "<amount> <currency> <categories>", empty when absent.
func (r comparedReturn) excludedText() (income, expense string) {
	if r.Excluded == nil {
		return "", ""
	}

	text := func(p *excludedPart) string {
		if p == nil {
			return ""
		}

		return fmt.Sprintf("%d %s %s", p.Amount.Amount, p.Amount.Currency, strings.Join(p.Categories, ", "))
	}

	return text(r.Excluded.Income), text(r.Excluded.Expense)
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
