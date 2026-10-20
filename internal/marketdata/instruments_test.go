package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
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
	return map[string]any{"code": "MXRF11", "type": "fii", "scale": 0, "name": "Maxi Renda", "quote_currency": "BRL", "exchange": "B3"}
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
	if got != (instrumentAPI{Code: "MXRF11", Type: "fii", Scale: 0, Name: "Maxi Renda", QuoteCurrency: "BRL", Exchange: "B3"}) {
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
	h.MustDo(http.MethodGet, "/api/v1/instruments?type=fii", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Code != "MXRF11" {
		t.Fatalf("fii list = %+v", list)
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments?type=currency", nil, http.StatusOK, &list)
	if len(list.Items) != 15 || list.Items[2].Code != "BRL" || list.Items[2].QuoteCurrency != "" {
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
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", with("scale", 13)), http.StatusBadRequest, "invalid_request", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/instruments", with("code", "mxrf11")), http.StatusBadRequest, "invalid_request", "")
}
