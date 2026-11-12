package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const coinbaseETH = `{"candles":[` +
	`{"start":"1794182400","low":"3010.1","high":"3100.2","open":"3050","close":"3088.45","volume":"1"},` +
	`{"start":"1794096000","low":"2990","high":"3070","open":"3000","close":"3050.12","volume":"1"},` +
	`{"start":"1794009600","low":"2950","high":"3010","open":"2960","close":"3001.5","volume":"1"}]}`

// S374: coinbase skips a product the exchange refuses and quotes the others (MQ17).
func TestS374CoinbaseUnknownProduct(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cb/products/ETH-USD/candles":
			_, _ = w.Write([]byte(coinbaseETH))
		case "/cb/products/BTC-BRL/candles":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write(
				[]byte(`{"error":"INVALID_ARGUMENT","message":"valid product_id is required"}`),
			)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2026-11-09"),
		apitest.PriceFeeds(nil, map[string]string{"coinbase": srv.URL + "/cb"}))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "BTC", "type": "crypto", "scale": 8, "name": "Bitcoin", "quote_currency": "BRL",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "ETH", "type": "crypto", "scale": 8, "name": "Ether", "quote_currency": "USD",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/coinbase",
		map[string]any{"enabled": true}, http.StatusOK, nil)

	h.App.Marketdata.TickFeeds(t.Context())

	got := cryptoPrices(t, h, "ETH", "USD")
	want := []priceAPI{
		{
			Instrument:      "ETH",
			QuoteInstrument: "USD",
			Date:            "2026-11-07",
			Value:           "3001.5",
			Source:          "coinbase",
		},
		{
			Instrument:      "ETH",
			QuoteInstrument: "USD",
			Date:            "2026-11-08",
			Value:           "3050.12",
			Source:          "coinbase",
		},
		{
			Instrument:      "ETH",
			QuoteInstrument: "USD",
			Date:            "2026-11-09",
			Value:           "3088.45",
			Source:          "coinbase",
		},
	}

	if len(got) != len(want) {
		t.Fatalf("prices = %+v, want %+v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("price %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	if btc := cryptoPrices(t, h, "BTC", "BRL"); len(btc) != 0 {
		t.Fatalf("BTC prices = %+v, want none", btc)
	}

	if e := feedsOf(t, h)["coinbase"].Error; e != nil {
		t.Fatalf("coinbase error = %v, want nil", *e)
	}
}

func cryptoPrices(t *testing.T, h *apitest.Harness, instrument, quote string) []priceAPI {
	t.Helper()

	var list struct {
		Items []priceAPI `json:"items"`
	}

	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument="+instrument+"&quote_instrument="+quote+"&from=2026-11-01&to=2026-11-09",
		nil,
		http.StatusOK,
		&list,
	)

	return list.Items
}
