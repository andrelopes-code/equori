package marketdata_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Assistant parity design F7 and F8: a price CSV attached to the conversation is recorded through
// the service of importPrices, all or nothing; the preview names the file and its line count.
func TestImportPriceFileTool(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	csv := "instrument,quote_instrument,date,value\nMXRF11,BRL,2026-11-02,9.00\nMXRF11,BRL,2026-11-03,9.02\n"

	r := h.Upload("/api/v1/assistant/files", "precos.csv", []byte(csv))
	if r.Status != http.StatusCreated {
		t.Fatalf("upload status %d: %s", r.Status, r.Body)
	}

	var file struct {
		ID string `json:"id"`
	}
	r.Decode(t, &file)

	args := map[string]any{"file_id": file.ID}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, res, err := h.App.Tools.Preview(
		auth.WithIdentity(
			t.Context(),
			h.MemberIDOf("owner@example.com"),
			h.BooksIDOf("owner@example.com"),
			auth.RoleOwner,
		),
		"import_price_file",
		b,
	)
	if err != nil || res.IsError {
		t.Fatalf("preview = %v, %s", err, res.Content)
	}

	want := tool.Preview{Action: "import_price_file", Changes: []tool.Change{
		{Field: "source", After: tool.TextValue("precos.csv")},
		{Field: "count", After: tool.TextValue("2")},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	res = h.Tool("import_price_file", args)
	if res.IsError {
		t.Fatalf("import_price_file = %s", res.Content)
	}

	var out struct {
		Recorded int `json:"recorded"`
	}
	if err := json.Unmarshal(res.Content, &out); err != nil {
		t.Fatal(err)
	}

	if out.Recorded != 2 {
		t.Errorf("recorded = %d, want 2", out.Recorded)
	}

	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectToolError(
		h.ToolAs("reader@example.com", auth.RoleRead, "import_price_file", args),
		"book_role_required",
		"",
	)
	h.ExpectToolError(
		h.Tool(
			"import_price_file",
			map[string]any{"file_id": "99999999-9999-9999-9999-999999999999"},
		),
		"invalid_arguments",
		"file_id",
	)
}
