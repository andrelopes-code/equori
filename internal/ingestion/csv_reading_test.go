package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type bookedRecord struct {
	Date   string `json:"date"`
	Amount struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
}

// S295.
func TestCSVRowsAroundTheDataS295(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	putSemicolonProfile(h, checking, map[string]any{"header_rows": 3, "footer_rows": 2})

	file := "Banco X\nConta;123\nData;Valor;Descrição\n05/10/2026;-1,00;a\n06/10/2026;-2,00;b\nTOTAL;;\nSaldo;-3,00;\n"
	b := mustImport(t, h, checking, "csv", "x.csv", []byte(file))

	if b.Counts.Created != 2 {
		t.Fatalf("counts: %s", counts(b))
	}
}

// S296.
func TestCSVDebitMarkerS296(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	putSemicolonProfile(h, checking, map[string]any{"debit_marker": "D"})

	file := "Data;Valor;Descrição\n05/10/2026;100,00 D;a\n06/10/2026;50,00 C;b\n07/10/2026;20,00;c\n"
	b := mustImport(t, h, checking, "csv", "x.csv", []byte(file))
	got := bookedByDate(t, h, b.ID)

	for date, want := range map[string]int64{"2026-10-05": -10000, "2026-10-06": 5000, "2026-10-07": 2000} {
		if got[date] != want {
			t.Errorf("amount on %s = %d, want %d", date, got[date], want)
		}
	}
}

// S297.
func TestCSVDatesS297(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	putSemicolonProfile(h, checking, nil)

	file := "Data;Valor;Descrição\n3/1/2026;-1,00;a\n04/01/2026 10:00;-2,00;b\n"
	b := mustImport(t, h, checking, "csv", "x.csv", []byte(file))
	got := bookedByDate(t, h, b.ID)

	if len(got) != 2 || got["2026-01-03"] != -100 || got["2026-01-04"] != -200 {
		t.Fatalf("records by date = %v", got)
	}
}

func putSemicolonProfile(h *apitest.Harness, account string, extra map[string]any) {
	body := map[string]any{
		"date_column": "Data", "date_layout": "DD/MM/YYYY", "amount_column": "Valor",
		"decimal_separator": ",", "description_column": "Descrição", "delimiter": "semicolon",
	}
	for k, v := range extra {
		body[k] = v
	}

	h.MustDo(http.MethodPut, "/api/v1/accounts/"+account+"/csv-profile", body, http.StatusOK, nil)
}

func bookedByDate(t *testing.T, h *apitest.Harness, batch string) map[string]int64 {
	t.Helper()

	var out struct {
		Items []bookedRecord `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch+"/records", nil, http.StatusOK, &out)

	got := make(map[string]int64, len(out.Items))
	for _, r := range out.Items {
		got[r.Date] = r.Amount.Amount
	}

	return got
}
