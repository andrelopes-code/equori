package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// S365: a symbol set on an instrument makes yahoo_chart quote it, and a change of the symbols
// requests the history again (MQ20).
func TestS365YahooSymbols(t *testing.T) {
	t.Parallel()

	fake := newYahooFake(t)
	h := apitest.New(t, apitest.As(usProfile()), apitest.Today("2026-11-09"),
		apitest.PriceFeeds([]string{"yahoo_chart"}, map[string]string{"yahoo_chart": fake.srv.URL + "/yahoo"}))

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "BRK.B", "type": "stock", "scale": 0, "name": "Berkshire B",
		"quote_currency": "USD", "exchange": "XNYS",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "BRKZ", "type": "stock", "scale": 0, "name": "Berkshire on NZX",
		"quote_currency": "USD", "exchange": "XNZE",
	}, http.StatusCreated, nil)

	if ids := coverageSources(t, h, "BRKZ"); len(ids) != 0 {
		t.Fatalf("coverage sources before = %v, want none", ids)
	}

	h.MustDo(http.MethodPatch, "/api/v1/instruments/BRKZ", map[string]any{
		"name": "Berkshire on NZX", "exchange": "XNZE", "symbols": map[string]string{"yahoo_chart": "BRK-B"},
	}, http.StatusOK, nil)

	if ids := coverageSources(t, h, "BRKZ"); !slices.Equal(ids, []string{"yahoo_chart"}) {
		t.Fatalf("coverage sources after = %v, want [yahoo_chart]", ids)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	paths := fake.recorded()
	if want := []string{"/yahoo/BRK-B", "/yahoo/BRK-B", "/yahoo/BRK-B", "/yahoo/BRK-B"}; !slices.Equal(paths, want) {
		t.Fatalf("requests = %v, want %v", paths, want)
	}

	var list struct {
		Items []priceAPI `json:"items"`
	}

	h.MustDo(http.MethodGet,
		"/api/v1/prices?instrument=BRKZ&quote_instrument=USD&from=2026-11-01&to=2026-11-09",
		nil, http.StatusOK, &list)

	want := []priceAPI{
		{Instrument: "BRKZ", QuoteInstrument: "USD", Date: "2026-11-04", Value: "349.51", Source: "yahoo_chart"},
		{Instrument: "BRKZ", QuoteInstrument: "USD", Date: "2026-11-05", Value: "344.17", Source: "yahoo_chart"},
		{Instrument: "BRKZ", QuoteInstrument: "USD", Date: "2026-11-06", Value: "342.37", Source: "yahoo_chart"},
	}
	if !slices.Equal(list.Items, want) {
		t.Fatalf("prices = %+v, want %+v", list.Items, want)
	}
}

// S364: an unofficial source needs an explicit acceptance to be enabled (MQ22).
func TestS364UnofficialConfirmation(t *testing.T) {
	t.Parallel()

	fake := newYahooFake(t)
	h := apitest.New(t, apitest.As(usProfile()), apitest.Today("2026-11-09"),
		apitest.PriceFeeds(nil, map[string]string{"yahoo_chart": fake.srv.URL + "/yahoo"}))

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "AAPL", "type": "stock", "scale": 0, "name": "Apple",
		"quote_currency": "USD", "exchange": "XNAS",
	}, http.StatusCreated, nil)

	r := h.Do(http.MethodPut, "/api/v1/market-data/feeds/yahoo_chart", map[string]any{"enabled": true})
	if r.Status != http.StatusUnprocessableEntity || !strings.Contains(string(r.Body), `"code":"unofficial_source"`) {
		t.Fatalf("enable without acceptance = %d %s, want 422 unofficial_source", r.Status, r.Body)
	}

	if feedsOf(t, h)["yahoo_chart"].Enabled {
		t.Fatal("yahoo_chart enabled after the refused request")
	}

	var got feedAPI

	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/yahoo_chart",
		map[string]any{"enabled": true, "accept_unofficial": true}, http.StatusOK, &got)

	if !got.Enabled || got.Official {
		t.Fatalf("feed = %+v, want enabled and not official", got)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	var list struct {
		Items []priceAPI `json:"items"`
	}

	h.MustDo(http.MethodGet,
		"/api/v1/prices?instrument=AAPL&quote_instrument=USD&from=2026-11-01&to=2026-11-09",
		nil, http.StatusOK, &list)

	want := []priceAPI{
		{Instrument: "AAPL", QuoteInstrument: "USD", Date: "2026-11-04", Value: "349.51", Source: "yahoo_chart"},
		{Instrument: "AAPL", QuoteInstrument: "USD", Date: "2026-11-05", Value: "344.17", Source: "yahoo_chart"},
		{Instrument: "AAPL", QuoteInstrument: "USD", Date: "2026-11-06", Value: "342.37", Source: "yahoo_chart"},
	}
	if !slices.Equal(list.Items, want) {
		t.Fatalf("prices = %+v, want %+v", list.Items, want)
	}

	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/yahoo_chart",
		map[string]any{"enabled": false}, http.StatusOK, &got)

	if got.Enabled {
		t.Fatalf("feed = %+v, want disabled", got)
	}
}

type yahooFake struct {
	srv   *httptest.Server
	mu    sync.Mutex
	paths []string
}

func newYahooFake(t *testing.T) *yahooFake {
	t.Helper()

	body, err := os.ReadFile("internal/feed/yahoochart/testdata/aapl.json")
	if err != nil {
		t.Fatal(err)
	}

	f := &yahooFake{}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/yahoo/") {
			http.NotFound(w, r)
			return
		}

		f.mu.Lock()
		f.paths = append(f.paths, r.URL.Path)
		f.mu.Unlock()

		_, _ = w.Write(body)
	}))
	t.Cleanup(f.srv.Close)

	return f
}

func (f *yahooFake) recorded() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.paths)
}

func usProfile() apitest.Profile {
	return apitest.Profile{Name: "united_states", Locale: locale.Locale{Language: "en", Region: "US"}, Base: "USD"}
}

func coverageSources(t *testing.T, h *apitest.Harness, code string) []string {
	t.Helper()

	var got struct {
		Coverage struct {
			Sources []struct {
				ID string `json:"id"`
			} `json:"sources"`
		} `json:"coverage"`
	}

	h.MustDo(http.MethodGet, "/api/v1/instruments/"+code, nil, http.StatusOK, &got)

	ids := []string{}
	for _, s := range got.Coverage.Sources {
		ids = append(ids, s.ID)
	}

	return ids
}
