package portfolio_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type riskMonthOut struct {
	Month            string `json:"month"`
	State            string `json:"state"`
	ReturnBP         *int   `json:"return_bp"`
	SpanMonths       *int   `json:"span_months"`
	DrawdownBP       *int   `json:"drawdown_bp"`
	VolatilityBP     *int   `json:"volatility_bp"`
	VolatilityMonths *int   `json:"volatility_months"`
	ExcludedBP       *int   `json:"excluded_bp"`
}

type riskSeriesOut struct {
	Key              string         `json:"key"`
	Months           []riskMonthOut `json:"months"`
	VolatilityBP     *int           `json:"volatility_bp"`
	VolatilityMonths *int           `json:"volatility_months"`
	MaxDrawdownBP    *int           `json:"max_drawdown_bp"`
	WeightBP         *int           `json:"weight_bp"`
	RiskShareBP      *int           `json:"risk_share_bp"`
	AccrualBP        *int           `json:"accrual_bp"`
}

type riskOut struct {
	ValueIn      string          `json:"value_in"`
	From         string          `json:"from"`
	To           string          `json:"to"`
	WindowMonths int             `json:"window_months"`
	Portfolio    riskSeriesOut   `json:"portfolio"`
	Classes      []riskSeriesOut `json:"classes"`
	Correlations []struct {
		A             string `json:"a"`
		B             string `json:"b"`
		CorrelationBP int    `json:"correlation_bp"`
		Months        int    `json:"months"`
	} `json:"correlations"`
	LeftOut []struct {
		Instrument string `json:"instrument"`
		Months     int    `json:"months"`
	} `json:"left_out"`
}

// S648: a purchase from the brokerage cash is internal to the portfolio, an income paid into the
// cash is return of the security, and a month without a price spans into the next (RK3 to RK6).
func TestS648MonthlyReturnsByClass(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fundCash(t, "2026-01-02", 100000)
	f.trade(t, "buy", "2026-01-02", 100, "10.00", 0)
	f.postPrice(t, "MXRF11", "BRL", "2026-01-31", "10.20")
	f.postPrice(t, "MXRF11", "BRL", "2026-02-28", "10.00")
	f.postPrice(t, "MXRF11", "BRL", "2026-03-31", "10.30")
	// May is priced by an accrual, a source of RK11.
	rate, err := money.ParseRate("10.10")
	if err != nil {
		t.Fatal(err)
	}

	if err := f.h.App.Marketdata.RecordPrices(t.Context(), f.h.OwnerID(), []marketdata.Price{{
		Instrument: "MXRF11",
		Quote:      "BRL",
		Date:       time.Date(2026, 5, 31, 0, 0, 0, 0, time.UTC),
		Value:      rate,
		Source:     "accrual",
	}}); err != nil {
		t.Fatal(err)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"income_type":     "dividend",
		"date":            "2026-02-15",
		"gross":           apitest.BRL(1000),
		"category_id":     f.dividends,
	}, http.StatusCreated, nil)

	got := f.risk(t, "to=2026-05-31&value_in=BRL")

	// Hand-computed by RK5: January earns from the day after the purchase, 102000 / 100000;
	// February splits at the income of the 15th, (102000 + 1000) / 102000 × 100000 / 102000;
	// March 3000 / 100000; April stale; May −2000 / 103000 over two months (modified Dietz).
	// The cash receives the income from the fund and gains nothing.
	reit := classOf(t, got, "reit")
	assertMonths(t, "reit", reit.Months, []monthWant{
		{"2026-01-31", "known", 200, 1},
		{"2026-02-28", "known", -100, 1},
		{"2026-03-31", "known", 300, 1},
		{"2026-04-30", "stale", 0, 0},
		{"2026-05-31", "known", -194, 2},
	})
	assertMonths(t, "currency", classOf(t, got, "currency").Months, []monthWant{
		{"2026-01-31", "nothing_held", 0, 0},
		{"2026-02-28", "known", 0, 1},
		{"2026-03-31", "known", 0, 1},
		{"2026-04-30", "known", 0, 1},
		{"2026-05-31", "known", 0, 1},
	})
	// The portfolio: 102000 / 100000, (101000 − 102000) / 102000, (104000 − 101000) / 101000; April holds the cash
	// alone, the fund left out (103000 of 104000); May holds the cash alone too, since the fund's
	// return covers two months (RK6): 101000 of 102000 left out.
	assertMonths(t, "portfolio", got.Portfolio.Months, []monthWant{
		{"2026-01-31", "known", 200, 1},
		{"2026-02-28", "known", -98, 1},
		{"2026-03-31", "known", 297, 1},
		{"2026-04-30", "known", 0, 1},
		{"2026-05-31", "known", 0, 1},
	})

	if april := got.Portfolio.Months[3]; intOf(april.ExcludedBP) != 9904 ||
		reit.Months[3].ExcludedBP == nil || got.Portfolio.Months[2].ExcludedBP != nil {
		t.Errorf("left out = %+v, reit %+v", april, reit.Months[3])
	}

	// April and May measure a hundredth of the value: no drawdown in them (RK8).
	if may := got.Portfolio.Months[4]; intOf(may.ExcludedBP) != 9902 ||
		may.DrawdownBP != nil || got.Portfolio.Months[3].DrawdownBP != nil ||
		got.Portfolio.Months[2].DrawdownBP == nil {
		t.Errorf(
			"may left out %d, drawdown %v; april %v; march %v",
			intOf(may.ExcludedBP),
			may.DrawdownBP,
			got.Portfolio.Months[3].DrawdownBP,
			got.Portfolio.Months[2].DrawdownBP,
		)
	}

	if len(got.LeftOut) != 1 || got.LeftOut[0].Instrument != "MXRF11" ||
		got.LeftOut[0].Months != 1 {
		t.Errorf("left out = %+v, want MXRF11 for one month", got.LeftOut)
	}

	if got.From != "2026-01-31" || got.To != "2026-05-31" || got.WindowMonths != 36 ||
		got.ValueIn != "BRL" {
		t.Errorf(
			"report = %s to %s, window %d, %s",
			got.From,
			got.To,
			got.WindowMonths,
			got.ValueIn,
		)
	}

	// 101000 of 102000 is 9901 basis points; the deepest fall of the fund is May's, from the peak
	// of March; the whole fund and 101000 of the 102000 of the portfolio are priced by accrual.
	if intOf(reit.WeightBP) != 9901 || intOf(reit.MaxDrawdownBP) != -194 ||
		intOf(reit.AccrualBP) != 10000 || reit.VolatilityBP != nil ||
		intOf(got.Portfolio.AccrualBP) != 9902 {
		t.Errorf("reit summary = %+v, portfolio accrual %d", reit, intOf(got.Portfolio.AccrualBP))
	}

	if intOf(reit.Months[1].DrawdownBP) != -100 || intOf(reit.Months[2].DrawdownBP) != 0 ||
		reit.Months[3].DrawdownBP != nil || intOf(reit.Months[4].DrawdownBP) != -194 {
		t.Errorf("reit drawdowns = %+v", reit.Months)
	}
}

// S649 and S651: thirteen months of a fund and a stock give a volatility, a correlation and the
// risk shares (RK7, RK9, RK10). The values were derived independently in Python from the prices:
// January earns from the day after the purchases, and each class contributes its gain over the
// portfolio's value of the month before.
func TestS649VolatilityCorrelationAndRiskShare(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fundCash(t, "2025-01-02", 200000)
	f.trade(t, "buy", "2025-01-02", 100, "10.00", 0)
	f.petr4Trade(t, "buy", "2025-01-02", 100, "10.00")

	ends := []string{
		"2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31", "2025-06-30",
		"2025-07-31", "2025-08-31", "2025-09-30", "2025-10-31", "2025-11-30", "2025-12-31",
		"2026-01-31",
	}
	fund := []string{
		"10.20", "10.00", "10.30", "10.10", "10.40", "10.20", "10.50", "10.30", "10.60",
		"10.40", "10.70", "10.50", "10.80",
	}
	stock := []string{
		"10.50", "9.80", "10.90", "10.20", "11.30", "10.10", "11.60", "10.40", "11.90",
		"10.70", "12.20", "11.00", "12.50",
	}

	for i, end := range ends {
		f.postPrice(t, "MXRF11", "BRL", end, fund[i])
		f.postPrice(t, "PETR4", "BRL", end, stock[i])
	}

	got := f.risk(t, "to=2026-02-15&value_in=BRL")

	tests := []struct {
		key                         string
		volatility, drawdown        int
		weight, share, months, last int
	}{
		{"stock", 3890, -1062, 5364, 8286, 13, 1364},
		{"reit", 851, -196, 4636, 1714, 13, 286},
	}
	for _, tt := range tests {
		c := classOf(t, got, tt.key)
		last := c.Months[len(c.Months)-1]

		if intOf(c.VolatilityBP) != tt.volatility || intOf(c.VolatilityMonths) != tt.months ||
			intOf(c.MaxDrawdownBP) != tt.drawdown || intOf(c.WeightBP) != tt.weight ||
			intOf(c.RiskShareBP) != tt.share || intOf(last.ReturnBP) != tt.last {
			t.Errorf("%s = %+v, want %+v", tt.key, c, tt)
		}
	}

	if got.Classes[0].Key != "stock" || got.Classes[1].Key != "reit" {
		t.Errorf(
			"classes are not ordered by weight: %s, %s",
			got.Classes[0].Key,
			got.Classes[1].Key,
		)
	}

	if intOf(got.Portfolio.VolatilityBP) != 2400 || intOf(got.Portfolio.MaxDrawdownBP) != -645 {
		t.Errorf("portfolio = %+v", got.Portfolio)
	}

	if len(got.Correlations) != 1 || got.Correlations[0].A != "stock" ||
		got.Correlations[0].B != "reit" || got.Correlations[0].CorrelationBP != 9826 ||
		got.Correlations[0].Months != 13 {
		t.Errorf("correlations = %+v", got.Correlations)
	}

	// The assistant reads the same summary through get_portfolio view risk (S4).
	var tool struct {
		Risk struct {
			Classes []struct {
				Key          string `json:"key"`
				VolatilityBP int    `json:"volatility_bp"`
				RiskShareBP  int    `json:"risk_share_bp"`
			} `json:"classes"`
			Correlations []struct {
				CorrelationBP int `json:"correlation_bp"`
			} `json:"correlations"`
		} `json:"risk"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "risk", "to": "2026-02-15"}, &tool)

	if len(tool.Risk.Classes) != 3 || tool.Risk.Classes[0].Key != "stock" ||
		tool.Risk.Classes[0].VolatilityBP != 3890 || tool.Risk.Classes[0].RiskShareBP != 8286 ||
		len(tool.Risk.Correlations) != 1 || tool.Risk.Correlations[0].CorrelationBP != 9826 {
		t.Errorf("tool risk = %+v", tool.Risk)
	}

	f.h.ExpectToolError(
		f.h.Tool("get_portfolio", map[string]any{"view": "risk", "from": "2026-01-01"}),
		"invalid_arguments",
		"from",
	)

	// Twelve months leave the floor met; the first month holds the volatility of none.
	if first := classOf(t, got, "stock").Months[10]; first.VolatilityBP != nil {
		t.Errorf("month 11 has a volatility over 11 returns: %+v", first)
	}
}

// S650: a month whose price is missing is missing, and the next known month spans it (RK3).
func TestS650MissingPrice(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fundCash(t, "2026-01-02", 100000)
	f.petr4Trade(t, "buy", "2026-01-02", 100, "10.00")
	// The trade records no price: PETR4 has none on or before January 31.
	f.postPrice(t, "PETR4", "BRL", "2026-02-27", "11.00")

	got := f.risk(t, "to=2026-02-28&value_in=BRL")

	// February spans from December 31 (59 days): 10000 / (100000 × 57/59) is 1035 basis points.
	assertMonths(t, "stock", classOf(t, got, "stock").Months, []monthWant{
		{"2026-01-31", "missing", 0, 0},
		{"2026-02-28", "known", 1035, 2},
	})
	assertMonths(t, "portfolio", got.Portfolio.Months, []monthWant{
		{"2026-01-31", "missing", 0, 0},
		{"2026-02-28", "known", 1035, 2},
	})
}

// S654: a deposit as large as the portfolio does not bend the month: the portfolio's monthly
// return chains the pieces between flow dates and equals the time-weighted return of the return
// report over the same days (RK5).
func TestS654MonthMatchesReturnReport(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fundCash(t, "2026-01-02", 100000)
	f.trade(t, "buy", "2026-01-02", 100, "10.00", 0)
	f.postPrice(t, "MXRF11", "BRL", "2026-01-02", "10.00")
	f.postPrice(t, "MXRF11", "BRL", "2026-01-09", "11.00")
	f.fundCash(t, "2026-01-15", 100000)
	f.postPrice(t, "MXRF11", "BRL", "2026-01-31", "9.90")

	got := f.risk(t, "to=2026-01-31&value_in=BRL")
	r := f.h.Do(http.MethodGet, "/api/v1/reports/return?from=2026-01-01&to=2026-01-31", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("return report status = %d: %s", r.Status, r.Body)
	}

	var report comparedReturn
	r.Decode(t, &report)

	// 110000 + 100000 at the deposit, 99000 + 100000 at the end: 1.10 × 199000 / 210000 − 1.
	assertMonths(t, "portfolio", got.Portfolio.Months, []monthWant{
		{"2026-01-31", "known", 424, 1},
	})

	if report.PeriodBP == nil || *report.PeriodBP != 424 {
		t.Errorf("return report = %v, want 424", report.PeriodBP)
	}
}

// S652: values in a currency other than the security's carry the rate of each month (C3).
func TestS652RiskInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fundCash(t, "2026-01-02", 100000)
	f.trade(t, "buy", "2026-01-02", 100, "10.00", 0)
	f.postPrice(t, "MXRF11", "BRL", "2026-01-31", "10.00")
	f.postPrice(t, "MXRF11", "BRL", "2026-02-28", "10.00")
	f.postPrice(t, "BRL", "USD", "2026-01-02", "0.20")
	f.postPrice(t, "BRL", "USD", "2026-01-31", "0.20")
	f.postPrice(t, "BRL", "USD", "2026-02-28", "0.21")

	got := f.risk(t, "to=2026-02-28&value_in=USD")

	// 1,000.00 BRL is 200.00 USD in January and 210.00 USD in February: 0 and 500 basis points.
	assertMonths(t, "reit", classOf(t, got, "reit").Months, []monthWant{
		{"2026-01-31", "known", 0, 1},
		{"2026-02-28", "known", 500, 1},
	})

	if got.ValueIn != "USD" {
		t.Errorf("value_in = %s", got.ValueIn)
	}
}

// S653: an invalid currency is refused, a book without a brokerage has no month, a reader reads
// the report and a request without a session is refused (B2).
func TestS653RiskRequests(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, "/api/v1/reports/risk?value_in=usd", nil),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)

	got := f.risk(t, "")
	if len(got.Portfolio.Months) != 0 || len(got.Classes) != 0 || len(got.Correlations) != 0 ||
		got.LeftOut == nil || got.From != "" {
		t.Errorf("empty book = %+v", got)
	}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if r := f.h.Call(
		reader,
		http.MethodGet,
		"/api/v1/reports/risk",
		nil,
	); r.Status != http.StatusOK {
		t.Errorf("reader status %d: %s", r.Status, r.Body)
	}

	if r := f.h.Call(&http.Client{}, http.MethodGet, "/api/v1/reports/risk", nil); r.Status !=
		http.StatusUnauthorized {
		t.Errorf("anonymous status %d", r.Status)
	}
}

type monthWant struct {
	month    string
	state    string
	returnBP int
	span     int
}

func assertMonths(t *testing.T, name string, got []riskMonthOut, want []monthWant) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("%s has %d months, want %d: %+v", name, len(got), len(want), got)
	}

	for i, w := range want {
		g := got[i]
		if g.Month != w.month || g.State != w.state || intOf(g.ReturnBP) != w.returnBP ||
			intOf(g.SpanMonths) != w.span {
			t.Errorf("%s month %d = %s %s %d span %d, want %+v",
				name, i, g.Month, g.State, intOf(g.ReturnBP), intOf(g.SpanMonths), w)
		}
	}
}

func (f fixture) risk(t *testing.T, query string) riskOut {
	t.Helper()
	f.h.Dispatch()

	var out riskOut
	f.h.MustDo(http.MethodGet, "/api/v1/reports/risk?"+query, nil, http.StatusOK, &out)

	return out
}

// fundCash moves amount from a checking account into the brokerage cash on date.
func (f fixture) fundCash(t *testing.T, date string, amount int64) {
	t.Helper()

	checking := f.h.Account("Checking "+date, "asset", "checking", nil)
	f.h.Record(date, apitest.Posting(checking, -amount), apitest.Posting(f.cash, amount))
}

func (f fixture) postPrice(t *testing.T, code, quote, date, value string) {
	t.Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       code,
		"quote_instrument": quote,
		"date":             date,
		"value":            value,
	}, http.StatusCreated, nil)
}

func classOf(t *testing.T, r riskOut, key string) riskSeriesOut {
	t.Helper()

	for _, c := range r.Classes {
		if c.Key == key {
			return c
		}
	}

	t.Fatalf("no class %q in %+v", key, r.Classes)

	return riskSeriesOut{}
}

func intOf(v *int) int {
	if v == nil {
		return 0
	}

	return *v
}
