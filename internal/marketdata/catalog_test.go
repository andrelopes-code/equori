package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

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

	h.ExpectProblem(h.Do(http.MethodGet, catalogPath+"i", nil), http.StatusUnprocessableEntity, "validation_failed", "q")

	h.MustDo(http.MethodGet, catalogPath+"zzzz", nil, http.StatusOK, &got)

	if want := (catalogAPI{Items: []catalogItemAPI{}, Unavailable: []string{}}); !reflect.DeepEqual(got, want) {
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

	h.ExpectProblem(h.Call(&http.Client{}, http.MethodGet, catalogPath+"ipca", nil), http.StatusUnauthorized, "unauthenticated", "")

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

	return apitest.New(t, apitest.Today("2026-11-09"),
		apitest.PriceFeeds([]string{"tesouro_direto"}, map[string]string{"tesouro_direto": srv.URL + "/td.csv"}))
}
