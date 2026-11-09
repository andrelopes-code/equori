package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// S355: an official source wins over an accrual price of the same date.
func TestS355OfficialBeatsAccrual(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(&feedServer{})
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds([]string{"bcb_ptax"}, feedURLs(srv)))

	h.App.Marketdata.TickFeeds(t.Context())

	if err := h.App.Marketdata.RecordPrices(t.Context(), []marketdata.Price{
		feedPrice(t, "accrual", "2026-10-29", "9.99"),
	}); err != nil {
		t.Fatal(err)
	}

	var list struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument=USD&quote_instrument=BRL&from=2026-10-29&to=2026-10-29", nil, http.StatusOK, &list)

	want := priceAPI{Instrument: "USD", QuoteInstrument: "BRL", Date: "2026-10-29", Value: "5.495", Source: "bcb_ptax"}
	if len(list.Items) != 1 || list.Items[0] != want {
		t.Fatalf("prices = %+v, want [%+v]", list.Items, want)
	}

	got := h.Rows("SELECT priority FROM marketdata_price WHERE source = 'accrual'")
	if !slices.Equal(got, []string{"4"}) {
		t.Fatalf("accrual priorities = %v", got)
	}
}

// S356: an unofficial source fills the dates that no official source covers and never wins.
func TestS356UnofficialFillsGaps(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "PETR4", "type": "stock", "scale": 0, "name": "Petrobras PN",
		"quote_currency": "BRL", "exchange": "BVMF",
	}, http.StatusCreated, nil)

	if err := h.App.Marketdata.RecordPrices(t.Context(), []marketdata.Price{
		securityPrice(t, "b3_consolidated", "2026-11-05", "32.45"),
	}); err != nil {
		t.Fatal(err)
	}

	if err := h.App.Marketdata.RecordPrices(t.Context(), []marketdata.Price{
		securityPrice(t, "yahoo_chart", "2026-11-05", "32.40"),
		securityPrice(t, "yahoo_chart", "2026-11-06", "32.50"),
	}); err != nil {
		t.Fatal(err)
	}

	var list struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument=PETR4&quote_instrument=BRL&from=2026-11-05&to=2026-11-06", nil, http.StatusOK, &list)

	want := []priceAPI{
		{Instrument: "PETR4", QuoteInstrument: "BRL", Date: "2026-11-05", Value: "32.45", Source: "b3_consolidated"},
		{Instrument: "PETR4", QuoteInstrument: "BRL", Date: "2026-11-06", Value: "32.5", Source: "yahoo_chart"},
	}
	if !slices.Equal(list.Items, want) {
		t.Fatalf("prices = %+v, want %+v", list.Items, want)
	}

	got := h.Rows("SELECT DISTINCT priority FROM marketdata_price WHERE source = 'yahoo_chart'")
	if !slices.Equal(got, []string{"5"}) {
		t.Fatalf("yahoo_chart priorities = %v", got)
	}
}

func securityPrice(t *testing.T, source, date, value string) marketdata.Price {
	t.Helper()

	v, err := money.ParseRate(value)
	if err != nil {
		t.Fatal(err)
	}

	return marketdata.Price{Instrument: "PETR4", Quote: "BRL", Date: day(date), Value: v, Source: source}
}
