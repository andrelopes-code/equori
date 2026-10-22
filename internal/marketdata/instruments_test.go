package marketdata_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type instrumentAPI struct {
	Code          string `json:"code"`
	Type          string `json:"type"`
	Scale         int    `json:"scale"`
	Name          string `json:"name"`
	QuoteCurrency string `json:"quote_currency"`
	Exchange      string `json:"exchange"`
}

func mxrf11() map[string]any {
	return map[string]any{"code": "MXRF11", "type": "reit", "scale": 0, "name": "Maxi Renda", "quote_currency": "BRL", "exchange": "BVMF"}
}

func TestDefineInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	r := h.Do(http.MethodPost, "/api/v1/instruments", mxrf11())
	var got instrumentAPI
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &got)
	if r.Header.Get("Location") != "/api/v1/instruments/MXRF11" {
		t.Fatalf("Location = %q", r.Header.Get("Location"))
	}
	if got != (instrumentAPI{Code: "MXRF11", Type: "reit", Scale: 0, Name: "Maxi Renda", QuoteCurrency: "BRL", Exchange: "BVMF"}) {
		t.Fatalf("instrument = %+v", got)
	}

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &read)
	if read != got {
		t.Fatalf("read = %+v", read)
	}
	var list struct {
		Items []instrumentAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments?type=reit", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Code != "MXRF11" {
		t.Fatalf("reit list = %+v", list)
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments?type=currency", nil, http.StatusOK, &list)
	brl := slices.IndexFunc(list.Items, func(i instrumentAPI) bool { return i.Code == "BRL" })
	if len(list.Items) != len(money.Currencies()) || brl < 0 || list.Items[brl].QuoteCurrency != "" {
		t.Fatalf("currency list = %+v", list.Items)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", mxrf11()), http.StatusConflict, "instrument_exists", "")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/instruments/PETR4", nil), http.StatusNotFound, "not_found", "")
}

func TestDefineInstrumentValidation(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	with := func(k string, v any) map[string]any {
		in := mxrf11()
		in[k] = v
		return in
	}
	tests := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{name: "currency type", body: with("type", "currency"), field: "type"},
		{name: "quote is a security", body: with("quote_currency", "PETR4"), field: "quote_currency"},
		{name: "unknown quote", body: with("quote_currency", "XYZ"), field: "quote_currency"},
		{name: "blank name", body: with("name", "  "), field: "name"},
		{name: "code of a currency", body: with("code", "BRL"), field: "code"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", tt.body), http.StatusUnprocessableEntity, "validation_failed", tt.field)
		})
	}
	for _, body := range []map[string]any{with("exchange", "B3"), with("exchange", "bvmf"), with("type", "fii"), with("type", "bdr")} {
		h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", body), http.StatusBadRequest, "invalid_request", "")
	}
	for _, body := range []map[string]any{with("exchange", "XNYS"), with("type", "depositary_receipt")} {
		if r := h.Do(http.MethodPost, "/api/v1/instruments", body); r.Status != http.StatusCreated && r.Status != http.StatusConflict {
			t.Fatalf("status %d: %s", r.Status, r.Body)
		}
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", with("scale", 13)), http.StatusBadRequest, "invalid_request", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", with("code", "mxrf11")), http.StatusBadRequest, "invalid_request", "")
}

func TestReconcileCurrencies(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ctx := t.Context()

	count := func() int {
		var n int
		if err := h.Pool.QueryRow(ctx, `SELECT count(*) FROM marketdata_instrument WHERE instrument_type = 'currency'`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if got, want := count(), len(money.Currencies()); got != want {
		t.Fatalf("currency instruments = %d, want %d", got, want)
	}

	if _, err := h.Pool.Exec(ctx, `UPDATE marketdata_instrument SET name = 'Custom' WHERE code = 'EUR'`); err != nil {
		t.Fatal(err)
	}
	if err := h.App.Marketdata.ReconcileCurrencies(ctx); err != nil {
		t.Fatal(err)
	}
	var name string
	if err := h.Pool.QueryRow(ctx, `SELECT name FROM marketdata_instrument WHERE code = 'EUR'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Custom" {
		t.Errorf("EUR name = %q, want Custom", name)
	}
}
