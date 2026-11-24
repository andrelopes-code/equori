package marketdata_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// splitHarness is an instance whose price report source states three splits of SBSP3: 1:125 on
// 2007-06-04 and 5:1 on 2026-04-29, which the closes confirm, and 3:1 on 2026-06-01, which they do not.
func splitHarness(t *testing.T) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Has("filelist") {
			http.NotFound(w, r)
			return
		}

		_, _ = fmt.Fprint(w, `[{"stockDividends":[
			{"isinCode":"BRSBSPACNOR5","label":"DESDOBRAMENTO","factor":"200,0","lastDatePrior":"29/05/2026"},
			{"isinCode":"BRSBSPACNOR5","label":"DESDOBRAMENTO","factor":"400,0","lastDatePrior":"28/04/2026"},
			{"isinCode":"BRSBSPACNOR5","label":"GRUPAMENTO","factor":"0,008","lastDatePrior":"01/06/2007"}]}]`)
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2026-11-12"), apitest.PriceFeeds(
		[]string{"b3_price_report"},
		map[string]string{"b3_price_report": srv.URL},
	))
	execSQL(t, h, `INSERT INTO marketdata_instrument
		(code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('SBSP3', 'stock', 0, 'Sabesp ON', 'BRL', 'BVMF')`)
	execSQL(t, h, `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority) VALUES
		('SBSP3', 'BRL', '2007-06-01', 0.315, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2007-06-04', 39.2, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2025-12-30', 150, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2026-04-28', 170, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2026-04-29', 33.97, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2026-05-29', 34, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2026-06-01', 34.5, 'b3_cotahist', 3),
		('SBSP3', 'BRL', '2026-11-11', 36, 'b3_cotahist', 3)`)

	h.App.Marketdata.TickFeeds(t.Context())

	return h
}

// S711: a split the closes confirm leaves no jump in the prices; the traded close stays, and a split
// the closes do not confirm is not stored (SA3, SA4).
func TestS711SplitAdjustedPrices(t *testing.T) {
	t.Parallel()

	h := splitHarness(t)

	assertRows(t, h.Rows(`SELECT date::text, trim_scale(ratio)::text, source FROM marketdata_split
		ORDER BY date`),
		"2007-06-04 0.008 b3_price_report", "2026-04-29 5 b3_price_report")

	var list struct {
		Items []struct {
			Date     string  `json:"date"`
			Value    string  `json:"value"`
			Adjusted *string `json:"adjusted"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet,
		"/api/v1/prices?instrument=SBSP3&quote_instrument=BRL&from=2007-01-01&to=2026-11-12",
		nil, http.StatusOK, &list)

	want := []string{
		"2007-06-01 0.315 7.875", "2007-06-04 39.2 7.84", "2025-12-30 150 30",
		"2026-04-28 170 34", "2026-04-29 33.97 -", "2026-05-29 34 -", "2026-06-01 34.5 -",
		"2026-11-11 36 -",
	}

	got := make([]string, len(list.Items))
	for i, p := range list.Items {
		adjusted := "-"
		if p.Adjusted != nil {
			adjusted = *p.Adjusted
		}

		got[i] = p.Date + " " + p.Value + " " + adjusted
	}

	assertRows(t, got, want...)
}

// S711: the change of a window that holds a split starts from the adjusted price (SA5).
func TestS711SplitAdjustedChanges(t *testing.T) {
	t.Parallel()

	h := splitHarness(t)

	q := quotesByInstrument(t, h)["SBSP3"]
	assertPoint(t, "SBSP3 last", q.Last, "2026-11-11", "36")
	assertPoint(t, "SBSP3 year to date", q.References.YearToDate, "2025-12-30", "30")
	assertPoint(t, "SBSP3 quarter", q.References.Quarter, "2026-06-01", "34.5")
}
