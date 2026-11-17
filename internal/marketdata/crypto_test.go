package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const coinbaseETH = `{"candles":[` +
	`{"start":"1794182400","low":"3010.1","high":"3100.2","open":"3050","close":"3088.45","volume":"1"},` +
	`{"start":"1794096000","low":"2990","high":"3070","open":"3000","close":"3050.12","volume":"1"},` +
	`{"start":"1794009600","low":"2950","high":"3010","open":"2960","close":"3001.5","volume":"1"}]}`

// S374: coinbase skips a product the exchange refuses and quotes the others (MQ17). S555: the
// candle of the running UTC day is stored after that day ends (A248 CQ3).
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

	var now atomic.Pointer[time.Time]

	setNow := func(s string) {
		at, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t.Fatal(err)
		}

		now.Store(&at)
	}
	setNow("2026-11-09T12:00:00Z")

	h := apitest.New(t,
		apitest.Clock(func() time.Time { return *now.Load() }),
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
	all := []priceAPI{
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

	requirePrices(t, got, all[:2])

	setNow("2026-11-10T00:00:00Z")
	h.App.Marketdata.TickFeeds(t.Context())

	requirePrices(t, cryptoPrices(t, h, "ETH", "USD"), all)

	if btc := cryptoPrices(t, h, "BTC", "BRL"); len(btc) != 0 {
		t.Fatalf("BTC prices = %+v, want none", btc)
	}

	if e := feedsOf(t, h)["coinbase"].Error; e != nil {
		t.Fatalf("coinbase error = %v, want nil", *e)
	}
}

func requirePrices(t *testing.T, got, want []priceAPI) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("prices = %+v, want %+v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("price %d = %+v, want %+v", i, got[i], want[i])
		}
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
