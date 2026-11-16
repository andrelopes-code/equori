package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type accrualPrice struct {
	Date   string `json:"date"`
	Value  string `json:"value"`
	Source string `json:"source"`
}

func pricesBetween(
	t *testing.T,
	h *apitest.Harness,
	instrument, from, to string,
) map[string]accrualPrice {
	t.Helper()
	var list struct {
		Items []accrualPrice `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument="+instrument+"&quote_instrument=BRL&from="+from+"&to="+to,
		nil,
		http.StatusOK,
		&list,
	)

	out := map[string]accrualPrice{}
	for _, p := range list.Items {
		out[p.Date] = p
	}

	return out
}

// S123: a CDB at 110% of the CDI accrues a price a business day; a manual price wins; new terms
// replace the accrued prices (amendment A126). The values were computed independently with
// 80-digit decimals.
func TestS123AccruedCDB(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", cdbTerms(), http.StatusOK, nil)

	h.App.Marketdata.TickFeeds(t.Context())
	got := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")

	want := map[string]string{
		"2026-01-02": "1000",
		"2026-01-05": "1000.606441",
		"2026-01-06": "1001.213249770686",
		"2026-01-07": "1001.820426535091",
		"2026-01-08": "1002.427971516379",
		"2026-01-09": "1003.035884937853",
	}
	if len(got) != len(want) {
		t.Fatalf("prices = %+v", got)
	}

	for d, v := range want {
		if got[d].Value != v || got[d].Source != "accrual" {
			t.Errorf("price on %s = %+v, want %s from accrual", d, got[d], v)
		}
	}

	// A tick with nothing new changes nothing.
	h.App.Marketdata.TickFeeds(t.Context())

	if again := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31"); len(again) != 6 {
		t.Fatalf("prices after a second tick = %+v", again)
	}

	// A manual price of the same day wins over the accrued one.
	h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "CDBXPTO",
			"quote_instrument": "BRL",
			"date":             "2026-01-07",
			"value":            "1500",
		},
		http.StatusCreated,
		nil,
	)

	if p := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")["2026-01-07"]; p.Source != "manual" ||
		p.Value != "1500" {
		t.Fatalf("price on the 7th = %+v", p)
	}

	// New terms delete the accrued prices; the next tick computes them again from the new face value.
	changed := cdbTerms()
	changed["face_value"] = 200000
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", changed, http.StatusOK, nil)

	if after := pricesBetween(
		t,
		h,
		"CDBXPTO",
		"2026-01-01",
		"2026-01-31",
	); len(after) != 1 ||
		after["2026-01-07"].Source != "manual" {
		t.Fatalf("prices after new terms = %+v", after)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	// The manual price of the 7th anchors the days after it (return honesty HR1): 1500 ×
	// 2006.071769875707 / 2003.640853070181, the accruals of the new face value.
	if p := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")["2026-01-09"]; p.Value != "1501.81987465603" {
		t.Fatalf("price on the 9th after the new face value = %+v", p)
	}
}

// HR1: a price that outranks the accrual anchors the accrued days after it, so the series grows
// from the recorded price instead of jumping back to the model. The values are 1500 times the
// accrual of the day over the accrual of the 7th, computed with 80-digit decimals.
func TestAccrualFollowsTheLatestOutrankingPrice(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", cdbTerms(), http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "CDBXPTO",
			"quote_instrument": "BRL",
			"date":             "2026-01-07",
			"value":            "1500",
		},
		http.StatusCreated,
		nil,
	)
	h.App.Marketdata.TickFeeds(t.Context())

	got := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")

	want := map[string]accrualPrice{
		"2026-01-06": {Value: "1001.213249770686", Source: "accrual"},
		"2026-01-07": {Value: "1500", Source: "manual"},
		"2026-01-08": {Value: "1500.909661499999", Source: "accrual"},
		"2026-01-09": {Value: "1501.819874656029", Source: "accrual"},
	}
	for d, w := range want {
		if got[d].Value != w.Value || got[d].Source != w.Source {
			t.Errorf("price on %s = %+v, want %+v", d, got[d], w)
		}
	}
}

// S124: a Tesouro IPCA+ with a spread over the monthly IPCA, applied from the end of each month.
func TestS124AccruedIPCA(t *testing.T) {
	t.Parallel()

	s := &sgsServer{ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-03-02"),
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

	got := pricesBetween(t, h, "NTNBXPTO", "2026-01-01", "2026-03-31")
	for d, v := range map[string]string{
		"2026-01-30": "1004.640317564163", "2026-02-02": "1009.343088309557", "2026-03-02": "1010.823298922241",
	} {
		if got[d].Value != v || got[d].Source != "accrual" {
			t.Errorf("price on %s = %+v, want %s", d, got[d], v)
		}
	}

	if _, ok := got["2026-03-03"]; ok {
		t.Error("a price after today")
	}
}

func TestAccrualStopsAtMaturity(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)
	defineFixedIncome(t, h, "CDBXPTO")

	terms := cdbTerms()
	terms["matures_on"] = "2026-01-07"
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", terms, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	got := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")
	if _, ok := got["2026-01-08"]; ok || got["2026-01-07"].Value != "1001.820426535091" {
		t.Fatalf("prices = %+v", got)
	}
}

// S467: a pre-fixed CDB of 12% a year over 252 business days skips the weekends and the holidays
// of its calendar (A236 FC5). The values were computed independently with 80-digit decimals.
func TestS467PreFixedAccruesOnBusinessDays(t *testing.T) {
	t.Parallel()

	got := accruePreFixed(t, "br_banking")

	want := map[string]string{
		"2026-01-30": "1009.034910724779",
		"2026-02-27": "1017.236102727987",
	}
	for d, v := range want {
		if got[d].Value != v || got[d].Source != "accrual" {
			t.Errorf("price on %s = %+v, want %s from accrual", d, got[d], v)
		}
	}

	// Carnival 2026 (Monday and Tuesday) and a Saturday carry no price.
	for _, d := range []string{"2026-02-16", "2026-02-17", "2026-01-03"} {
		if p, ok := got[d]; ok {
			t.Errorf("price on %s = %+v, want none", d, p)
		}
	}
}

// S470: a calendar of no region (weekends only) prices every weekday, Carnival included.
func TestS470WeekendCalendarAccruesEveryWeekday(t *testing.T) {
	t.Parallel()

	got := accruePreFixed(t, "weekend")

	if _, ok := got["2026-02-16"]; !ok {
		t.Error("no price on 2026-02-16")
	}

	if p := got["2026-02-27"]; p.Value != "1018.151451061362" {
		t.Errorf("price on 2026-02-27 = %+v, want 1018.151451061362", p)
	}
}

func accruePreFixed(t *testing.T, calendar string) map[string]accrualPrice {
	t.Helper()

	h := apitest.New(t, apitest.Today("2026-02-27"))
	defineFixedIncome(t, h, "CDBPRE")

	var terms termsAPI
	h.MustDo(
		http.MethodPut,
		"/api/v1/instruments/CDBPRE/terms",
		map[string]any{
			"issued_on":   "2026-01-02",
			"matures_on":  "2030-01-02",
			"spread_bp":   1200,
			"day_count":   "bus252",
			"calendar_id": calendar,
			"face_value":  100000,
		},
		http.StatusOK,
		&terms,
	)

	if terms.CalendarID != calendar || terms.DailyLiquidity {
		t.Fatalf("terms = %+v", terms)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	return pricesBetween(t, h, "CDBPRE", "2026-01-01", "2026-02-28")
}
