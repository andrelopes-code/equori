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
	Encoding          string `json:"encoding"`
	GroupSeparator    string `json:"group_separator"`
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
	if saved.Delimiter != "comma" || saved.HeaderRows != 1 || saved.AmountSign != "as_is" || saved.AmountColumn != "Valor" || saved.Encoding != "auto" || saved.GroupSeparator != "," {
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

	delete(body, "debit_column")
	delete(body, "credit_column")
	body["encoding"] = "ebcdic"
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusUnprocessableEntity, "validation_failed", "encoding")
	body["encoding"] = "windows-1251"
	h.MustDo(http.MethodPut, path, body, http.StatusOK, &saved)
	if saved.Encoding != "windows-1251" {
		t.Fatalf("encoding = %q", saved.Encoding)
	}

	body["group_separator"] = ";"
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusBadRequest, "invalid_request", "group_separator")
	body["group_separator"], body["decimal_separator"] = ".", "."
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusUnprocessableEntity, "validation_failed", "group_separator")
	body["group_separator"], body["decimal_separator"], body["date_layout"] = "'", ".", "DD/DD/YYYY"
	h.ExpectProblem(h.Do(http.MethodPut, path, body), http.StatusUnprocessableEntity, "validation_failed", "date_layout")
	body["date_layout"] = "DD.MM.YYYY"
	h.MustDo(http.MethodPut, path, body, http.StatusOK, &saved)
	if saved.DateLayout != "DD.MM.YYYY" || saved.GroupSeparator != "'" {
		t.Fatalf("formats = %q, %q", saved.DateLayout, saved.GroupSeparator)
	}

	other := h.Login("other@example.com")
	h.ExpectProblem(h.Call(other, http.MethodPut, path, map[string]any{"date_column": "Data", "date_layout": "DD/MM/YYYY", "amount_column": "Valor", "decimal_separator": ".", "description_column": "D"}),
		http.StatusNotFound, "not_found", "")
}
