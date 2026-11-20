package portfolio_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type attributionOut struct {
	Years []attributionYearOut `json:"years"`
}

type attributionYearOut struct {
	Year      int                    `json:"year"`
	From      string                 `json:"from"`
	Since     string                 `json:"since"`
	To        string                 `json:"to"`
	Result    *moneyOut              `json:"result"`
	Capital   *moneyOut              `json:"capital"`
	ReturnBP  *int                   `json:"return_bp"`
	Other     *attributionPartOut    `json:"other"`
	Missing   []string               `json:"missing"`
	Items     []attributionItemOut   `json:"items"`
	Rate      *attributionCompareOut `json:"rate"`
	Inflation *attributionCompareOut `json:"inflation"`
}

type attributionPartOut struct {
	Result         moneyOut `json:"result"`
	WeightBP       int      `json:"weight_bp"`
	ContributionBP int      `json:"contribution_bp"`
	ReturnBP       *int     `json:"return_bp"`
}

type attributionItemOut struct {
	Instrument     string   `json:"instrument"`
	Result         moneyOut `json:"result"`
	WeightBP       int      `json:"weight_bp"`
	ContributionBP int      `json:"contribution_bp"`
	ReturnBP       *int     `json:"return_bp"`
	StaleSince     *string  `json:"stale_since"`
}

type attributionCompareOut struct {
	Index       string   `json:"index"`
	Until       string   `json:"until"`
	ReturnBP    int      `json:"return_bp"`
	Result      moneyOut `json:"result"`
	IndexBP     int      `json:"index_bp"`
	IndexResult moneyOut `json:"index_result"`
	RealBP      *int     `json:"real_bp"`
}

// S656 (portfolio attribution AT1 to AT4, AT7 to AT9): two holdings of 2025 and 2026; each year
// splits the portfolio's money result into the result of each holding, the weights add up to
// 100% and the contributions to the portfolio's return.
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

	// 2025 is measured from 2025-01-02, the day the money came (AT13): 364 days from 2025-01-01,
	// the deposit at work 363 of them, a capital of 10,000.00 × 363/364 = 9,972.53. MXRF11 is
	// measured from its purchase: 1,100.00 − 1,000.00 + 50.00 = 150.00, its dividend leaving for
	// the cash on 2025-06-16, 198 days before the end: 150.00 on (1,000.00 × 355 − 50.00 × 198)
	// ÷ 356 (15.47%); on the capital of the portfolio it weighs (1,000.00 × 355 − 50.00 × 198) ÷
	// 363 (9.51%) and adds 150.00 ÷ 9,972.53 (1.50 points). PETR4: −200.00, −10.03%, 19.56%,
	// −2.00 points. The portfolio: −50.00 ÷ 9,972.53 = −0.50%. The cash weighs the rest, 70.93%,
	// and adds nothing.
	y := got.Years[0]
	assertYear(t, y, wantYear{2025, "2025-01-01", "2025-12-31", -5000, 997253, -50, 7093})
	assertItems(t, y, []wantItem{
		{"MXRF11", 15000, 1547, 951, 150},
		{"PETR4", -20000, -1003, 1956, -200},
	})

	if y.Since != "2025-01-02" {
		t.Fatalf("since = %q", y.Since)
	}

	// 2026 to 2026-11-01 (305 days): a capital of 9,950.00. MXRF11 1,200.00 − 1,100.00 = 100.00 on
	// 1,100.00; PETR4 sells 50 at 22.00 for 1,095.00 after the tax and ends at 1,050.00: 1,050.00
	// + 1,095.00 − 1,800.00 = 345.00 on 1,800.00 − 1,095.00 × 244/305 = 924.00. The portfolio:
	// 445.00 ÷ 9,950.00 = 4.47%.
	y = got.Years[1]
	assertYear(t, y, wantYear{2026, "2026-01-01", "2026-11-01", 44500, 995000, 447, 7966})
	assertItems(t, y, []wantItem{
		{"PETR4", 34500, 3734, 929, 347},
		{"MXRF11", 10000, 909, 1105, 100},
	})

	if y.Rate != nil || y.Inflation != nil {
		t.Fatalf("comparisons without rates = %+v, %+v", y.Rate, y.Inflation)
	}
}

// S658 (AT5): PETR4 holds the price of 2025-06-30 at the end of 2025; its row states the date
// and has no rate, and its result, weight and contribution stay in the sums.
func TestS658AttributionStalePrice(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t, "PETR4")
	f.datedPrice(t, "PETR4", "2025-06-30", "18.00")

	y := f.attribution(t).Years[0]

	assertYear(t, y, wantYear{2025, "2025-01-01", "2025-12-31", -5000, 997253, -50, 7093})
	assertItems(t, y, []wantItem{
		{"MXRF11", 15000, 1547, 951, 150},
		{"PETR4", -20000, 0, 1956, -200},
	})

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
		y.Other != nil || y.ReturnBP != nil || len(y.Items) != 0 {
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

// S670 (AT10 to AT12): a CDI on every day of 2025 from 2025-01-02, zero but for 0.1% on three
// days, the last 2025-12-31, and an IPCA of 0.31% in December only. The 10,000.00 of 2025-01-02
// would have earned 30.03 in the CDI and 31.00 in the IPCA, on the capital of 9,972.53: 0.30%
// and 0.31%. The portfolio lost 50.00, so its real return is (9,972.53 − 50.00) ÷ (9,972.53 +
// 31.00) − 1 = −0.81%. A CDI that starts in June, 151 days after the money came, would read the
// days before it as no growth: the comparison is then absent (AT11).
func TestS670AttributionComparisons(t *testing.T) {
	t.Parallel()

	// The index feeds are enabled so their stored rates are read; their source answers nothing.
	silent := httptest.NewServer(http.NotFoundHandler())
	t.Cleanup(silent.Close)

	urls := map[string]string{"br_cdi": silent.URL, "br_ipca": silent.URL}
	f := attributionBook(t, newFixture(t, apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, urls)))

	late := attributionBook(t, newFixture(t, apitest.IndexFeeds([]string{"br_cdi"}, urls)))
	late.indexRate(t, "cdi", "2025-06-02", "0.001")

	if y := late.attribution(t).Years[0]; y.Rate != nil {
		t.Fatalf("rate over a hole = %+v", y.Rate)
	}

	for d := day("2025-01-02"); !d.After(day("2025-12-31")); d = d.AddDate(0, 0, 1) {
		rate := "0"

		switch d.Format(time.DateOnly) {
		case "2025-06-02", "2025-06-03", "2025-12-31":
			rate = "0.001"
		}

		f.indexRate(t, "cdi", d.Format(time.DateOnly), rate)
	}

	for m := 1; m <= 12; m++ {
		rate := "0"
		if m == 12 {
			rate = "0.0031"
		}

		f.indexRate(t, "ipca", fmt.Sprintf("2025-%02d-01", m), rate)
	}

	y := f.attribution(t).Years[0]

	if c := y.Rate; c == nil || c.Index != "cdi" || c.Until != "2025-12-31" ||
		c.ReturnBP != -50 || c.Result.Amount != -5000 || c.IndexBP != 30 ||
		c.IndexResult.Amount != 3003 || c.RealBP != nil {
		t.Fatalf("rate = %+v", c)
	}

	if c := y.Inflation; c == nil || c.Index != "ipca" || c.Until != "2025-12-31" ||
		c.ReturnBP != -50 || c.IndexBP != 31 || c.IndexResult.Amount != 3100 ||
		c.RealBP == nil || *c.RealBP != -81 {
		t.Fatalf("inflation = %+v", c)
	}
}

// S671 (AT11, R2): a book of a region whose indexes are not of its base currency, or that has
// none, has no comparison; the rest of the year stands.
func TestS671AttributionWithoutIndex(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t)
	f.indexRate(t, "cdi", "2025-12-31", "0.001")
	f.moveToRegion(t, "DE")

	y := f.attribution(t).Years[0]

	if y.Rate != nil || y.Inflation != nil || y.ReturnBP == nil || *y.ReturnBP != -50 {
		t.Fatalf("year outside Brazil = %+v", y)
	}
}

// S656 through the tool: the view attribution returns the same years.
func TestGetPortfolioToolAttribution(t *testing.T) {
	t.Parallel()

	f := attributionFixture(t)
	f.h.Dispatch()

	var got struct {
		Years []struct {
			Year     int        `json:"year"`
			Result   tool.Money `json:"result"`
			ReturnBP int        `json:"return_bp"`
			Items    []struct {
				Instrument     string     `json:"instrument"`
				Result         tool.Money `json:"result"`
				WeightBP       int        `json:"weight_bp"`
				ContributionBP int        `json:"contribution_bp"`
				ReturnBP       int        `json:"return_bp"`
			} `json:"items"`
		} `json:"years"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "attribution"}, &got)

	if len(got.Years) != 2 || got.Years[0].Result.Amount != "-50.00" ||
		got.Years[0].ReturnBP != -50 || len(got.Years[0].Items) != 2 {
		t.Fatalf("attribution = %+v", got)
	}

	first := got.Years[0].Items[0]
	if first.Instrument != "MXRF11" || first.Result.Amount != "150.00" || first.ReturnBP != 1547 ||
		first.WeightBP != 951 || first.ContributionBP != 150 {
		t.Fatalf("first item = %+v", first)
	}
}

type wantYear struct {
	year          int
	from, to      string
	result        int64
	capital       int64
	returnBP      int
	otherWeightBP int
}

type wantItem struct {
	instrument     string
	result         int64
	returnBP       int
	weightBP       int
	contributionBP int
}

// attributionFixture deposits 10,000.00 on 2025-01-02, buys 100 MXRF11 at 10.00 and 100 PETR4
// at 20.00 on 2025-01-10, receives a dividend of 50.00 of MXRF11 on 2025-06-16 and prices both
// on 2025-12-31 at 11.00 and 18.00. skip names prices left out: "PETR4" the close of 2025-12-31,
// "PETR4-all" every price of PETR4.
func attributionFixture(t *testing.T, skip ...string) fixture {
	t.Helper()

	return attributionBook(t, newFixture(t), skip...)
}

func attributionBook(t *testing.T, f fixture, skip ...string) fixture {
	t.Helper()

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

func (f fixture) indexRate(t *testing.T, index, date, rate string) {
	t.Helper()

	if _, err := f.h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES ($1, $2, $3, 'test')`,
		index,
		date,
		rate,
	); err != nil {
		t.Fatal(err)
	}
}

func (f fixture) attribution(t *testing.T) attributionOut {
	t.Helper()
	f.h.Dispatch()

	var out attributionOut
	f.h.MustDo(http.MethodGet, "/api/v1/reports/attribution", nil, http.StatusOK, &out)

	return out
}

func assertYear(t *testing.T, y attributionYearOut, w wantYear) {
	t.Helper()

	if y.Year != w.year || y.From != w.from || y.To != w.to || y.Result == nil ||
		y.Result.Amount != w.result || y.Result.Currency != "BRL" || y.Capital == nil ||
		y.Capital.Amount != w.capital || y.ReturnBP == nil || *y.ReturnBP != w.returnBP ||
		y.Other == nil || y.Other.Result.Amount != 0 || y.Other.WeightBP != w.otherWeightBP ||
		y.Other.ContributionBP != 0 || len(y.Missing) != 0 {
		t.Fatalf("year = %+v (other %+v), want %+v", y, y.Other, w)
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
		if got.Instrument != w.instrument || got.Result.Amount != w.result || !rateOK ||
			got.WeightBP != w.weightBP || got.ContributionBP != w.contributionBP {
			t.Fatalf("%d item %d = %+v (return_bp %v), want %+v", y.Year, i, got, got.ReturnBP, w)
		}
	}
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}
