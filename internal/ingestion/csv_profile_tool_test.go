package ingestion_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Assistant parity design F7: the assistant reads and saves the CSV profile of an account through
// the services of getCsvProfile and saveCsvProfile, then imports a csv file with it.
func TestCSVProfileTools(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Itaú checking", "asset", "checking", nil)

	if r := h.Tool("get_csv_profile", map[string]any{"account_id": checking}); !r.IsError {
		t.Fatalf("profile before saving = %s, want an error", r.Content)
	}

	save := map[string]any{
		"account_id":         checking,
		"delimiter":          "semicolon",
		"date_column":        "Data",
		"date_layout":        "DD/MM/YYYY",
		"amount_column":      "Valor",
		"decimal_separator":  ",",
		"description_column": "Histórico",
	}
	if r := h.Tool("save_csv_profile", save); r.IsError {
		t.Fatalf("save_csv_profile = %s", r.Content)
	}

	r := h.Tool("get_csv_profile", map[string]any{"account_id": checking})
	if r.IsError {
		t.Fatalf("get_csv_profile = %s", r.Content)
	}

	var got map[string]any
	if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatal(err)
	}

	for field, want := range map[string]any{
		"delimiter": "semicolon", "header_rows": float64(1), "date_column": "Data",
		"date_layout": "DD/MM/YYYY", "amount_column": "Valor", "decimal_separator": ",",
		"group_separator": ".", "description_column": "Histórico", "amount_sign": "as_is",
	} {
		if got[field] != want {
			t.Errorf("%s = %v, want %v", field, got[field], want)
		}
	}

	file := attachToConversation(
		t,
		h,
		"itau.csv",
		[]byte("Data;Valor;Histórico\n03/10/2026;-12,50;Padaria\n"),
	)

	var imported struct {
		Created int `json:"created"`
	}
	decode(
		t,
		h.Tool("import_statement_file", map[string]any{"file_id": file, "account_id": checking}),
		&imported,
	)

	if imported.Created != 1 {
		t.Errorf("created = %d, want 1", imported.Created)
	}

	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectToolError(
		h.ToolAs("reader@example.com", auth.RoleRead, "save_csv_profile", save),
		"book_role_required",
		"",
	)

	if r := h.ToolAs("reader@example.com", auth.RoleRead, "get_csv_profile", map[string]any{
		"account_id": checking,
	}); r.IsError {
		t.Errorf("get_csv_profile of a reader = %s", r.Content)
	}

	var profile struct {
		Delimiter string `json:"delimiter"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+checking+"/csv-profile",
		nil,
		http.StatusOK,
		&profile,
	)

	if profile.Delimiter != "semicolon" {
		t.Errorf("profile of the screen = %+v, want semicolon", profile)
	}
}
