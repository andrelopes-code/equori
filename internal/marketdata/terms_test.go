package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

type termsAPI struct {
	IssuedOn         string `json:"issued_on"`
	MaturesOn        string `json:"matures_on"`
	IndexID          string `json:"index_id"`
	PercentOfIndexBP int    `json:"percent_of_index_bp"`
	SpreadBP         int    `json:"spread_bp"`
	DayCount         string `json:"day_count"`
	FaceValue        int64  `json:"face_value"`
}

func defineFixedIncome(t *testing.T, h *apitest.Harness, code string) {
	t.Helper()
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": code, "type": "fixed_income", "scale": 0, "name": code, "quote_currency": "BRL"}, http.StatusCreated, nil)
}

func cdbTerms() map[string]any {
	return map[string]any{
		"issued_on": "2026-01-02", "matures_on": "2028-01-02", "index_id": "cdi", "percent_of_index_bp": 11000,
		"spread_bp": 0, "day_count": "bus252", "face_value": 100000,
	}
}

func TestInstrumentTerms(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CDBXPTO")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/instruments/CDBXPTO/terms", nil), http.StatusNotFound, "not_found", "")

	var got termsAPI
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", cdbTerms(), http.StatusOK, &got)
	want := termsAPI{IssuedOn: "2026-01-02", MaturesOn: "2028-01-02", IndexID: "cdi", PercentOfIndexBP: 11000, DayCount: "bus252", FaceValue: 100000}
	if got != want {
		t.Fatalf("put = %+v, want %+v", got, want)
	}
	var read termsAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/CDBXPTO/terms", nil, http.StatusOK, &read)
	if read != want {
		t.Fatalf("read = %+v", read)
	}

	// Omitted fields take their defaults; the terms are replaced as a whole.
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", map[string]any{
		"issued_on": "2026-02-02", "matures_on": "2030-02-02", "index_id": "ipca", "spread_bp": 600, "day_count": "act365", "face_value": 100000,
	}, http.StatusOK, &got)
	if got != (termsAPI{IssuedOn: "2026-02-02", MaturesOn: "2030-02-02", IndexID: "ipca", PercentOfIndexBP: 10000, SpreadBP: 600, DayCount: "act365", FaceValue: 100000}) {
		t.Fatalf("replaced = %+v", got)
	}
	// An instrument without an index is pre-fixed.
	var prefixed termsAPI
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBXPTO/terms", map[string]any{
		"issued_on": "2026-02-02", "matures_on": "2030-02-02", "spread_bp": 1200, "day_count": "act365", "face_value": 100000,
	}, http.StatusOK, &prefixed)
	if prefixed.IndexID != "" || prefixed.SpreadBP != 1200 {
		t.Fatalf("pre-fixed = %+v", prefixed)
	}
}

// S125: terms are refused where they make no sense.
func TestInstrumentTermsErrors(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	put := func(code string, change map[string]any) apitest.Response {
		body := cdbTerms()
		for k, v := range change {
			if v == nil {
				delete(body, k)
				continue
			}
			body[k] = v
		}
		return h.Do(http.MethodPut, "/api/v1/instruments/"+code+"/terms", body)
	}
	h.ExpectProblem(put("MXRF11", nil), http.StatusUnprocessableEntity, "validation_failed", "code")
	h.ExpectProblem(put("NOPE11", nil), http.StatusNotFound, "not_found", "")
	h.ExpectProblem(put("BRL", nil), http.StatusUnprocessableEntity, "validation_failed", "code")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"matures_on": "2026-01-02"}), http.StatusUnprocessableEntity, "validation_failed", "matures_on")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"face_value": 0}), http.StatusBadRequest, "invalid_request", "face_value")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"percent_of_index_bp": 0}), http.StatusBadRequest, "invalid_request", "percent_of_index_bp")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"spread_bp": -1}), http.StatusBadRequest, "invalid_request", "spread_bp")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"index_id": "CDI"}), http.StatusBadRequest, "invalid_request", "index_id")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"day_count": "act360"}), http.StatusBadRequest, "invalid_request", "day_count")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"index_id": "ipca"}), http.StatusUnprocessableEntity, "validation_failed", "day_count")
	h.ExpectProblem(put("CDBXPTO", map[string]any{"index_id": nil}), http.StatusUnprocessableEntity, "validation_failed", "day_count")
}

func TestSchemaRejectsInvalidTerms(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency)
		VALUES ('CDBXPTO', 'fixed_income', 0, 'CDB', 'BRL'), ('PETR4', 'stock', 0, 'Petrobras', 'BRL')`); err != nil {
		t.Fatal(err)
	}
	const cols = `INSERT INTO marketdata_fixed_income_terms (instrument_code, issued_on, matures_on, index_id, percent_of_index_bp, spread_bp, day_count, face_value) VALUES `
	tests := []struct{ name, sql string }{
		{"matures before issue", cols + `('CDBXPTO', '2026-01-02', '2026-01-02', 'cdi', 10000, 0, 'bus252', 100000)`},
		{"zero face value", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'cdi', 10000, 0, 'bus252', 0)`},
		{"zero percent", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'cdi', 0, 0, 'bus252', 100000)`},
		{"negative spread", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'cdi', 10000, -1, 'bus252', 100000)`},
		{"index outside the pattern", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'CDI', 10000, 0, 'bus252', 100000)`},
		{"unknown day count", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'cdi', 10000, 0, 'act360', 100000)`},
		{"bus252 without the cdi index", cols + `('CDBXPTO', '2026-01-02', '2027-01-02', 'ipca', 10000, 0, 'bus252', 100000)`},
		{"unknown instrument", cols + `('NOPE11', '2026-01-02', '2027-01-02', 'cdi', 10000, 0, 'bus252', 100000)`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}
