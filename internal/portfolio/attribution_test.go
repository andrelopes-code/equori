package portfolio_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type attributionOut struct {
	Years []attributionYearOut `json:"years"`
}

type attributionYearOut struct {
	Year     int                  `json:"year"`
	From     string               `json:"from"`
	To       string               `json:"to"`
	Result   *moneyOut            `json:"result"`
	PeriodBP *int                 `json:"period_bp"`
	Other    *moneyOut            `json:"other"`
	Missing  []string             `json:"missing"`
	Items    []attributionItemOut `json:"items"`
}

type attributionItemOut struct {
	Instrument string   `json:"instrument"`
	Result     moneyOut `json:"result"`
	ReturnBP   *int     `json:"return_bp"`
	StaleSince *string  `json:"stale_since"`
}

// S656 (portfolio attribution AT1 to AT4, AT7): two holdings of 2025 and 2026; each year splits
// the portfolio's money result into the result of each holding, and the rows add up to it.
// S657 (AT2, AT3): a sale of 2026 withholds R$ 5.00 of tax; the holding's result takes it, so
// other stays zero.
func TestS656S657Attribution(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t)
	f.stockTrade(t, "sell", "2026-03-02", 50, "22.00", 500)
	f.datedPrice(t, "MXRF11", "2026-10-30", "12.00")
	f.datedPrice(t, "PETR4", "2026-10-30", "21.00")

	got := f.attribution(t)

	if len(got.Years) != 2 {
		t.Fatalf("years = %+v", got.Years)
	}

	// 2025: MXRF11 1,100.00 − 1,000.00 + 50.00 of dividend = 150.00 on 1,000.00 × 355/365;
	// PETR4 1,800.00 − 2,000.00 = −200.00 on 2,000.00 × 355/365. The portfolio: 9,950.00 −
	// 10,000.00 of contribution = −50.00.
	y := got.Years[0]
	assertYear(t, y, 2025, "2025-01-01", "2025-12-31", -5000)
	assertItems(t, y, []wantItem{{"MXRF11", 15000, 1542}, {"PETR4", -20000, -1028}})

	// 2026 to 2026-11-01 (305 days): MXRF11 1,200.00 − 1,100.00 = 100.00 on 1,100.00; PETR4
	// sells 50 at 22.00 for 1,095.00 after the tax and ends at 1,050.00: 1,050.00 + 1,095.00 −
	// 1,800.00 = 345.00 on 1,800.00 − 1,095.00 × 244/305.
	y = got.Years[1]
	assertYear(t, y, 2026, "2026-01-01", "2026-11-01", 44500)
	assertItems(t, y, []wantItem{{"PETR4", 34500, 3734}, {"MXRF11", 10000, 909}})

	for _, y := range got.Years {
		ret := f.periodBP(t, y.From, y.To)
		if y.PeriodBP == nil || *y.PeriodBP != ret {
			t.Fatalf("%d period_bp = %v, the return report says %d", y.Year, y.PeriodBP, ret)
		}
	}
}

// S658 (AT5): PETR4 holds the price of 2025-06-30 at the end of 2025; its row states the date
// and has no rate, and its result stays in the sum.
func TestS658AttributionStalePrice(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t, "PETR4")
	f.datedPrice(t, "PETR4", "2025-06-30", "18.00")

	y := f.attribution(t).Years[0]

	assertYear(t, y, 2025, "2025-01-01", "2025-12-31", -5000)
	assertItems(t, y, []wantItem{{"MXRF11", 15000, 1542}, {"PETR4", -20000, 0}})

	if s := y.Items[1].StaleSince; s == nil || *s != "2025-06-30" {
		t.Fatalf("stale_since = %v", s)
	}

	if y.Items[0].StaleSince != nil {
		t.Fatalf("MXRF11 stale_since = %v", *y.Items[0].StaleSince)
	}
}

// S659 (AT6): PETR4 has no price at the end of 2025; the year names it and holds no figure.
// Another book is a member without brokerage: no year.
func TestS659AttributionMissingPrice(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t, "PETR4", "PETR4-all")

	y := f.attribution(t).Years[0]

	if y.Year != 2025 || len(y.Missing) != 1 || y.Missing[0] != "PETR4" || y.Result != nil ||
		y.Other != nil || y.PeriodBP != nil || len(y.Items) != 0 {
		t.Fatalf("year = %+v", y)
	}

	stranger := f.h.Login("stranger@example.com")
	r := f.h.Call(stranger, http.MethodGet, "/api/v1/reports/attribution", nil)

	if r.Status != http.StatusOK {
		t.Fatalf("stranger status %d: %s", r.Status, r.Body)
	}

	var out attributionOut
	r.Decode(t, &out)

	if len(out.Years) != 0 {
		t.Fatalf("stranger years = %+v", out.Years)
	}
}

type wantItem struct {
	instrument string
	result     int64
	returnBP   int
}

// attributionFixture deposits 10,000.00 on 2025-01-02, buys 100 MXRF11 at 10.00 and 100 PETR4
// at 20.00 on 2025-01-10, receives a dividend of 50.00 of MXRF11 on 2025-06-16 and prices both
// on 2025-12-31 at 11.00 and 18.00. skip names prices left out: "PETR4" the close of 2025-12-31,
// "PETR4-all" every price of PETR4.
func attributionFixture(t *testing.T, skip ...string) fixture {
	t.Helper()

	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-01-02", apitest.Posting(checking, -1000000), apitest.Posting(f.cash, 1000000))
	f.trade(t, "buy", "2025-01-10", 100, "10.00", 0)
	f.stockTrade(t, "buy", "2025-01-10", 100, "20.00", 0)
	f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"income_type":     "dividend",
		"date":            "2025-06-16",
		"gross":           apitest.BRL(5000),
		"category_id":     f.dividends,
	}, http.StatusCreated, nil)
	f.datedPrice(t, "MXRF11", "2025-12-31", "11.00")

	skipped := map[string]bool{}
	for _, s := range skip {
		skipped[s] = true
	}

	if !skipped["PETR4"] {
		f.datedPrice(t, "PETR4", "2025-12-31", "18.00")
	}

	if skipped["PETR4-all"] {
		if _, err := f.h.Pool.Exec(
			t.Context(),
			"DELETE FROM marketdata_price WHERE instrument = 'PETR4'",
		); err != nil {
			t.Fatalf("delete prices: %v", err)
		}
	}

	return f
}

func (f fixture) datedPrice(t *testing.T, code, date, value string) {
	t.Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       code,
		"quote_instrument": "BRL",
		"date":             date,
		"value":            value,
	}, http.StatusCreated, nil)
}

func (f fixture) attribution(t *testing.T) attributionOut {
	t.Helper()
	f.h.Dispatch()

	var out attributionOut
	f.h.MustDo(http.MethodGet, "/api/v1/reports/attribution", nil, http.StatusOK, &out)

	return out
}

func (f fixture) periodBP(t *testing.T, from, to string) int {
	t.Helper()

	var out struct {
		PeriodBP int `json:"period_bp"`
	}
	f.h.MustDo(
		http.MethodGet,
		fmt.Sprintf("/api/v1/reports/return?from=%s&to=%s", from, to),
		nil,
		http.StatusOK,
		&out,
	)

	return out.PeriodBP
}

func assertYear(t *testing.T, y attributionYearOut, year int, from, to string, result int64) {
	t.Helper()

	if y.Year != year || y.From != from || y.To != to || y.Result == nil ||
		y.Result.Amount != result || y.Result.Currency != "BRL" || y.Other == nil ||
		y.Other.Amount != 0 || len(y.Missing) != 0 {
		t.Fatalf("year = %+v, want %d %s..%s result %d other 0", y, year, from, to, result)
	}
}

// assertItems checks the rows in order; a returnBP of 0 expects no rate.
func assertItems(t *testing.T, y attributionYearOut, want []wantItem) {
	t.Helper()

	if len(y.Items) != len(want) {
		t.Fatalf("%d items = %+v, want %+v", y.Year, y.Items, want)
	}

	for i, w := range want {
		got := y.Items[i]

		rateOK := (w.returnBP == 0 && got.ReturnBP == nil) ||
			(got.ReturnBP != nil && *got.ReturnBP == w.returnBP)
		if got.Instrument != w.instrument || got.Result.Amount != w.result || !rateOK {
			t.Fatalf("%d item %d = %+v (return_bp %v), want %+v", y.Year, i, got, got.ReturnBP, w)
		}
	}
}

// S656 through the tool: the view attribution returns the same years.
func TestGetPortfolioToolAttribution(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t)
	f.h.Dispatch()

	var got struct {
		Years []struct {
			Year   int        `json:"year"`
			Result tool.Money `json:"result"`
			Items  []struct {
				Instrument string     `json:"instrument"`
				Result     tool.Money `json:"result"`
				ReturnBP   *int       `json:"return_bp"`
			} `json:"items"`
		} `json:"years"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "attribution"}, &got)

	if len(got.Years) != 2 || got.Years[0].Result.Amount != "-50.00" ||
		len(got.Years[0].Items) != 2 || got.Years[0].Items[0].Instrument != "MXRF11" ||
		got.Years[0].Items[0].Result.Amount != "150.00" ||
		got.Years[0].Items[0].ReturnBP == nil || *got.Years[0].Items[0].ReturnBP != 1542 {
		t.Fatalf("attribution = %+v", got)
	}
}
