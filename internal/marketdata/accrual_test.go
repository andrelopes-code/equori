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

func pricesBetween(t *testing.T, h *apitest.Harness, instrument, from, to string) map[string]accrualPrice {
	t.Helper()
	var list struct {
		Items []accrualPrice `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument="+instrument+"&quote_instrument=BRL&from="+from+"&to="+to, nil, http.StatusOK, &list)
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
	h := apitest.New(t, apitest.Today("2026-01-09"), apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)))
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", cdbTerms(), http.StatusOK, nil)

	h.App.Marketdata.TickFeeds(t.Context())
	got := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")
	want := map[string]string{
		"2026-01-02": "1000", "2026-01-05": "1000.606441", "2026-01-06": "1001.213249770686",
		"2026-01-07": "1001.820426535091", "2026-01-08": "1002.427971516379", "2026-01-09": "1003.035884937853",
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
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "CDBXPTO", "quote_instrument": "BRL", "date": "2026-01-07", "value": "1500"}, http.StatusCreated, nil)
	if p := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")["2026-01-07"]; p.Source != "manual" || p.Value != "1500" {
		t.Fatalf("price on the 7th = %+v", p)
	}

	// New terms delete the accrued prices; the next tick computes them again from the new face value.
	changed := cdbTerms()
	changed["face_value"] = 200000
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", changed, http.StatusOK, nil)
	if after := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31"); len(after) != 1 || after["2026-01-07"].Source != "manual" {
		t.Fatalf("prices after new terms = %+v", after)
	}
	h.App.Marketdata.TickFeeds(t.Context())
	if p := pricesBetween(t, h, "CDBXPTO", "2026-01-01", "2026-01-31")["2026-01-09"]; p.Value != "2006.071769875707" {
		t.Fatalf("price on the 9th after the new face value = %+v", p)
	}
}

// S124: a Tesouro IPCA+ with a spread over the monthly IPCA, applied from the end of each month.
func TestS124AccruedIPCA(t *testing.T) {
	t.Parallel()
	s := &sgsServer{ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-03-02"), apitest.IndexFeeds([]string{"br_ipca"}, indexURLs(srv)))
	defineFixedIncome(t, h, "NTNBXPTO")
	h.MustDo(http.MethodPut, "/api/v1/instruments/NTNBXPTO/terms", map[string]any{
		"issued_on": "2026-01-01", "matures_on": "2035-05-15", "index_id": "ipca", "spread_bp": 600, "day_count": "act365", "face_value": 100000,
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
	h := apitest.New(t, apitest.Today("2026-01-09"), apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)))
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
