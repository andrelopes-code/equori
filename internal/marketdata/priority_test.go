package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
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
