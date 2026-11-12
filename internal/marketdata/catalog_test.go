package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type catalogItemAPI struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Exchange      string `json:"exchange"`
	QuoteCurrency string `json:"quote_currency"`
	Symbol        string `json:"symbol"`
	Source        string `json:"source"`
	Defined       bool   `json:"defined"`
}

type catalogAPI struct {
	Items       []catalogItemAPI `json:"items"`
	Unavailable []string         `json:"unavailable"`
}

const catalogPath = "/api/v1/market-data/catalog?q="

var ntnbp2035 = catalogItemAPI{
	Code: "NTNBP.20350515", Name: "Tesouro IPCA+ 2035", Type: "fixed_income", QuoteCurrency: "BRL",
	Source: "tesouro_direto",
}

// S372: a search over the enabled sources lists what they can quote (MQ28, MQ29).
func TestS372CatalogSearch(t *testing.T) {
	t.Parallel()

	h := tesouroHarness(t, http.StatusOK)

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &got)

	want := catalogAPI{Items: []catalogItemAPI{ntnbp2035}, Unavailable: []string{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("search = %+v, want %+v", got, want)
	}

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "NTNBP.20350515", "type": "fixed_income", "scale": 2,
		"name": "Tesouro IPCA+ 2035", "quote_currency": "BRL",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &got)

	want.Items[0].Defined = true
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("defined search = %+v, want %+v", got, want)
	}

	h.ExpectProblem(
		h.Do(http.MethodGet, catalogPath+"i", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"q",
	)

	h.MustDo(http.MethodGet, catalogPath+"zzzz", nil, http.StatusOK, &got)

	if want := (catalogAPI{Items: []catalogItemAPI{}, Unavailable: []string{}}); !reflect.DeepEqual(
		got,
		want,
	) {
		t.Fatalf("no match = %+v, want %+v", got, want)
	}
}

func TestS372CatalogSourceFails(t *testing.T) {
	t.Parallel()

	h := tesouroHarness(t, http.StatusInternalServerError)

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &got)

	want := catalogAPI{Items: []catalogItemAPI{}, Unavailable: []string{"tesouro_direto"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("failing source = %+v, want %+v", got, want)
	}
}

func TestS372CatalogNoSource(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &got)

	want := catalogAPI{Items: []catalogItemAPI{}, Unavailable: []string{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("no source = %+v, want %+v", got, want)
	}
}

// S372: a listing of two sources merges by code, exchange and quote currency (MQ29).
func TestCatalogMerge(t *testing.T) {
	t.Parallel()

	h := catalogHarness(t, 0, coinbaseProducts)

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"bit", nil, http.StatusOK, &got)

	want := catalogAPI{
		Items: []catalogItemAPI{{
			Code: "BTC", Name: "Bitcoin", Type: "crypto", QuoteCurrency: "USD", Symbol: "BTC-USD",
			Source: "coinbase",
		}},
		Unavailable: []string{},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("merge = %+v, want %+v", got, want)
	}
}

// S372: a source that exceeds the bound is named in unavailable; the others answer (MQ29).
func TestS372CatalogTimeout(t *testing.T) {
	t.Parallel()

	h := catalogHarness(t, time.Millisecond, func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	})

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "NTNBP.20350515", "type": "fixed_income", "scale": 2,
		"name": "Tesouro IPCA+ 2035", "quote_currency": "BRL",
	}, http.StatusCreated, nil)

	// The fetch sets the Tesouro list, so its search reads memory.
	h.App.Marketdata.TickFeeds(t.Context())

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &got)

	item := ntnbp2035
	item.Defined = true

	want := catalogAPI{Items: []catalogItemAPI{item}, Unavailable: []string{"coinbase"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("timeout = %+v, want %+v", got, want)
	}
}

// A223 B2: the catalog reads the instance's market data, a reader role.
func TestCatalogRoles(t *testing.T) {
	t.Parallel()

	h := tesouroHarness(t, http.StatusOK)

	var want catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"ipca", nil, http.StatusOK, &want)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	var got catalogAPI

	if r := h.Call(reader, http.MethodGet, catalogPath+"ipca", nil); r.Status != http.StatusOK {
		t.Fatalf("reader = %d: %s", r.Status, r.Body)
	} else {
		r.Decode(t, &got)
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("reader = %+v, want %+v", got, want)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, catalogPath+"ipca", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)

	other := h.Login("other@example.com")

	if r := h.Call(other, http.MethodGet, catalogPath+"ipca", nil); r.Status != http.StatusOK {
		t.Fatalf("other book = %d: %s", r.Status, r.Body)
	} else {
		r.Decode(t, &got)
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("other book = %+v, want %+v", got, want)
	}
}

// A222 X2: the catalog of a region other than Brazil lists Yahoo quotes under their MIC (MQ28).
func TestCatalogOutsideBrazil(t *testing.T) {
	t.Parallel()

	body, err := os.ReadFile("feed/yahoochart/testdata/search.json")
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/yahoo/v1/finance/search" {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.As(usProfile()),
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(
			[]string{"yahoo_chart"},
			map[string]string{"yahoo_chart": srv.URL + "/yahoo"},
		),
	)

	var got catalogAPI

	h.MustDo(http.MethodGet, catalogPath+"apple", nil, http.StatusOK, &got)

	if len(got.Items) != 3 {
		t.Fatalf("items = %+v, want 3", got.Items)
	}

	want := catalogItemAPI{
		Code: "AAPL", Name: "Apple Inc.", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD",
		Symbol: "AAPL", Source: "yahoo_chart",
	}
	if got.Items[1] != want {
		t.Fatalf("item 2 = %+v, want %+v", got.Items[1], want)
	}
}

// catalogHarness enables tesouro_direto and coinbase against fakes; coinbase answers with handler.
// A non-zero bound sets the catalog and the probe bound of one source.
func catalogHarness(t *testing.T, bound time.Duration, coinbase http.HandlerFunc) *apitest.Harness {
	t.Helper()

	td := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(tesouroFixture))
	}))
	t.Cleanup(td.Close)

	cb := httptest.NewServer(coinbase)
	t.Cleanup(cb.Close)

	opts := []apitest.Option{
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(
			[]string{"tesouro_direto", "coinbase"},
			map[string]string{"tesouro_direto": td.URL + "/td.csv", "coinbase": cb.URL},
		),
	}
	if bound != 0 {
		opts = append(opts, apitest.FeedBounds(bound, bound))
	}

	return apitest.New(t, opts...)
}

func coinbaseProducts(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte(`{"products":[
{"product_id":"BTC-USD","base_currency_id":"BTC","quote_currency_id":"USD","base_name":"Bitcoin","is_disabled":false},
{"product_id":"BTC-USDC","base_currency_id":"BTC","quote_currency_id":"USDC","base_name":"Bitcoin","is_disabled":false},
{"product_id":"ETH-EUR","base_currency_id":"ETH","quote_currency_id":"EUR","base_name":"Ethereum","is_disabled":false},
{"product_id":"OLD-USD","base_currency_id":"OLD","quote_currency_id":"USD","base_name":"Old Bitcoin","is_disabled":true}
],"num_products":4}`))
}

// tesouroHarness enables tesouro_direto against a fake that answers status; a 200 serves
// tesouroFixture.
func tesouroHarness(t *testing.T, status int) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if status != http.StatusOK {
			http.Error(w, "down", status)
			return
		}

		_, _ = w.Write([]byte(tesouroFixture))
	}))
	t.Cleanup(srv.Close)

	return apitest.New(
		t,
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(
			[]string{"tesouro_direto"},
			map[string]string{"tesouro_direto": srv.URL + "/td.csv"},
		),
	)
}
