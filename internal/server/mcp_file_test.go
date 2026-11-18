package server_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Assistant parity design F11 and ADR 024 X20: an MCP client uploads a file to /mcp/files with
// its access token and passes the file_id to a tool; /mcp/files takes no session and no foreign
// origin, and /api/ still refuses the token.
func TestMCPFileTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Checking", "asset", "checking", nil)
	token := mcpToken(t, h, h.Client, "write")
	client := &http.Client{Transport: bearer(token)}

	statement := apitest.OFX(
		"",
		apitest.OFXLine{Date: "20261003", Amount: "-12.50", FITID: "m1", Name: "Padaria"},
		apitest.OFXLine{Date: "20261010", Amount: "-40.00", FITID: "m2", Name: "Mercado"},
	)

	if r := h.UploadAs(
		client,
		"/api/v1/assistant/files",
		nil,
		"extrato.ofx",
		statement,
	); r.Status !=
		http.StatusUnauthorized {
		t.Fatalf("token on /api: status %d, want 401", r.Status)
	}

	if r := h.UploadAs(h.Client, "/mcp/files", nil, "extrato.ofx", statement); r.Status !=
		http.StatusUnauthorized {
		t.Fatalf("session on /mcp/files: status %d, want 401", r.Status)
	}

	r := h.UploadAs(client, "/mcp/files", nil, "extrato.ofx", statement)
	if r.Status != http.StatusCreated {
		t.Fatalf("upload with the token: %d %s", r.Status, r.Body)
	}

	var file struct {
		ID   string `json:"id"`
		Kind string `json:"kind"`
	}
	r.Decode(t, &file)

	if file.Kind != "ofx" {
		t.Errorf("kind = %q, want ofx", file.Kind)
	}

	res, err := mcpSession(t, h, token).CallTool(t.Context(), &mcp.CallToolParams{
		Name:      "import_statement_file",
		Arguments: map[string]any{"file_id": file.ID, "account_id": checking},
	})
	if err != nil || res.IsError {
		t.Fatalf("import_statement_file: %v %+v", err, res)
	}

	var out struct {
		Created int `json:"created"`
	}
	if err := json.Unmarshal([]byte(resultText(t, res)), &out); err != nil {
		t.Fatal(err)
	}

	if out.Created != 2 {
		t.Errorf("created = %d, want 2", out.Created)
	}

	h.ExpectProblem(
		h.UploadAs(client, "/mcp/files", nil, "archive.zip", []byte("PK\x03\x04\x14\x00\x00\x00")),
		http.StatusUnsupportedMediaType,
		"file_kind_unsupported",
		"",
	)
}
