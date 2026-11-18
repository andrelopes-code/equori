package ingestion_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Assistant parity design F7, F8 and F9: a statement file attached to the conversation is imported
// into an account through the service of importFile; the preview names the file, the account and
// the line count, and the same file twice creates nothing.
func TestImportStatementFileTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank checking", "asset", "checking", nil)

	statement := apitest.OFX(
		"",
		apitest.OFXLine{Date: "20261003", Amount: "-12.50", FITID: "a1", Name: "Padaria"},
		apitest.OFXLine{Date: "20261010", Amount: "-40.00", FITID: "a2", Name: "Mercado"},
	)
	file := attachToConversation(t, h, "extrato.ofx", statement)
	args := map[string]any{"file_id": file, "account_id": checking}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(
		auth.WithIdentity(
			t.Context(),
			h.MemberIDOf("owner@example.com"),
			h.BooksIDOf("owner@example.com"),
			auth.RoleOwner,
		),
		"import_statement_file",
		b,
	)
	if err != nil || r.IsError {
		t.Fatalf("preview = %v, %s", err, r.Content)
	}

	want := tool.Preview{Action: "import_statement_file", Changes: []tool.Change{
		{Field: "source", After: tool.TextValue("extrato.ofx")},
		{Field: "account", After: tool.TextValue("Nubank checking")},
		{Field: "count", After: tool.TextValue("2")},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	var first, second struct {
		Created int `json:"created"`
	}

	decode(t, h.Tool("import_statement_file", args), &first)
	decode(t, h.Tool("import_statement_file", args), &second)

	if first.Created != 2 || second.Created != 0 {
		t.Errorf("created = %d then %d, want 2 then 0", first.Created, second.Created)
	}

	h.ExpectToolError(
		h.Tool("import_statement_file", map[string]any{
			"file_id":    "77777777-7777-7777-7777-777777777777",
			"account_id": checking,
		}),
		"invalid_arguments",
		"file_id",
	)

	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectToolError(
		h.ToolAs("reader@example.com", auth.RoleRead, "import_statement_file", args),
		"book_role_required",
		"",
	)

	pdf := attachToConversation(t, h, "nota.pdf", []byte("%PDF-1.7\n1 0 obj"))
	h.ExpectToolError(
		h.Tool("import_statement_file", map[string]any{"file_id": pdf, "account_id": checking}),
		"invalid_arguments",
		"file_id",
	)
}

func attachToConversation(t *testing.T, h *apitest.Harness, name string, content []byte) string {
	t.Helper()

	r := h.Upload("/api/v1/assistant/files", name, content)
	if r.Status != http.StatusCreated {
		t.Fatalf("upload %s: status %d: %s", name, r.Status, r.Body)
	}

	var f struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(r.Body, &f); err != nil {
		t.Fatal(err)
	}

	return f.ID
}

func decode(t *testing.T, r tool.Result, out any) {
	t.Helper()

	if r.IsError {
		t.Fatalf("tool error %s", r.Content)
	}

	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}
