package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type csvProfile struct {
	Delimiter         string `json:"delimiter"`
	HeaderRows        int    `json:"header_rows"`
	DateColumn        string `json:"date_column"`
	DateLayout        string `json:"date_layout"`
	AmountColumn      string `json:"amount_column"`
	DecimalSeparator  string `json:"decimal_separator"`
	DescriptionColumn string `json:"description_column"`
	AmountSign        string `json:"amount_sign"`
}

func TestCSVProfile(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	path := "/api/v1/accounts/" + checking + "/csv-profile"
	h.ExpectProblem(h.Do(http.MethodGet, path, nil), http.StatusNotFound, "not_found", "")

	body := map[string]any{"date_column": "Data", "date_layout": "DD/MM/YYYY", "amount_column": "Valor", "decimal_separator": ".", "description_column": "Descrição"}
	var saved csvProfile
	h.MustDo(http.MethodPut, path, body, http.StatusOK, &saved)
	if saved.Delimiter != "comma" || saved.HeaderRows != 1 || saved.AmountSign != "as_is" || saved.AmountColumn != "Valor" {
		t.Fatalf("saved = %+v", saved)
	}
	var got csvProfile
	h.MustDo(http.MethodGet, path, nil, http.StatusOK, &got)
	if got != saved {
		t.Fatalf("got %+v, saved %+v", got, saved)
	}

	body["delimiter"], body["header_rows"] = "semicolon", 0
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusUnprocessableEntity, "validation_failed", "date_column")
	body["header_rows"], body["debit_column"], body["credit_column"] = 1, "Débito", "Crédito"
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusUnprocessableEntity, "validation_failed", "amount_column")

	other := h.Login("other@example.com")
	h.ExpectProblem(h.Call(other, http.MethodPut, path, map[string]any{"date_column": "Data", "date_layout": "DD/MM/YYYY", "amount_column": "Valor", "decimal_separator": ".", "description_column": "D"}),
		http.StatusNotFound, "not_found", "")
}
