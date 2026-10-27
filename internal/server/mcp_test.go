package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// bearer sets the Authorization header of every request.
type bearer string

func (b bearer) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+string(b))
	return http.DefaultTransport.RoundTrip(r)
}

func mcpToken(t *testing.T, h *apitest.Harness, c *http.Client, scope string) string {
	t.Helper()
	r := h.Call(c, http.MethodPost, "/api/v1/access-tokens", map[string]any{"name": "test", "scope": scope, "expires_in_days": 30})
	var out struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}
	if r.Status != http.StatusCreated {
		t.Fatalf("create token: %d %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	return out.Token
}

func mcpSession(t *testing.T, h *apitest.Harness, token string) *mcp.ClientSession {
	t.Helper()
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	s, err := client.Connect(t.Context(), &mcp.StreamableClientTransport{
		Endpoint: h.URL() + "/mcp", HTTPClient: &http.Client{Transport: bearer(token)}, DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func listNames(t *testing.T, s *mcp.ClientSession) map[string]*mcp.Tool {
	t.Helper()
	out := map[string]*mcp.Tool{}
	for tl, err := range s.Tools(t.Context(), nil) {
		if err != nil {
			t.Fatal(err)
		}
		out[tl.Name] = tl
	}
	return out
}

func resultText(t *testing.T, r *mcp.CallToolResult) string {
	t.Helper()
	if len(r.Content) != 1 {
		t.Fatalf("content = %d parts", len(r.Content))
	}
	tc, ok := r.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatalf("content[0] = %T", r.Content[0])
	}
	return tc.Text
}

// rawMCP posts an initialize request to /mcp with the header set and returns the response.
func rawMCP(t *testing.T, h *apitest.Harness, method, path string, header map[string]string, body []byte) apitest.Response {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), method, h.URL()+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	for k, v := range header {
		if k == "Host" {
			req.Host = v
			continue
		}
		req.Header.Set(k, v)
	}
	return h.Send(&http.Client{}, req)
}

var initialize = []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"raw","version":"1"}}}`)

// Design 2026-10-26 3.9, X14, X15: a read token lists the ReadOnly tools, a write token every tool.
func TestMCPListsToolsByScope(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var reads []string
	for _, tl := range h.App.Tools.Tools() {
		if tl.Spec().Effect == tool.ReadOnly {
			reads = append(reads, tl.Spec().Name)
		}
	}
	read := listNames(t, mcpSession(t, h, mcpToken(t, h, h.Client, "read")))
	// The spec's 19 and 36 counted the registry of 2026-10-26; the registry is the authority.
	if len(read) != len(reads) {
		t.Fatalf("read token lists %d tools, registry has %d ReadOnly", len(read), len(reads))
	}
	for _, n := range reads {
		if tl, ok := read[n]; !ok || tl.Annotations == nil || !tl.Annotations.ReadOnlyHint {
			t.Errorf("read token: %s missing or without readOnlyHint", n)
		}
	}
	write := listNames(t, mcpSession(t, h, mcpToken(t, h, h.Client, "write")))
	if len(write) != len(h.App.Tools.Tools()) {
		t.Fatalf("write token lists %d tools, registry has %d", len(write), len(h.App.Tools.Tools()))
	}
	for _, tl := range h.App.Tools.Tools() {
		s, got := tl.Spec(), write[tl.Spec().Name]
		if got == nil || got.Annotations == nil || got.Annotations.IdempotentHint != s.Idempotent ||
			(s.Effect == tool.Destructive) != (got.Annotations.DestructiveHint != nil && *got.Annotations.DestructiveHint) {
			t.Errorf("write token: %s annotations = %+v", s.Name, got)
		}
	}
}

// X16, X12, ADR 003: the result is the registry's, as structured content and one text block, for the token's user only.
func TestMCPCallTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.Account("Mine", "asset", "checking", nil)
	other := h.Login("bob@example.com")
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Bobs secret", "class": "asset", "kind": "checking", "currency": "BRL"})
	s := mcpSession(t, h, mcpToken(t, h, h.Client, "read"))
	res, err := s.CallTool(t.Context(), &mcp.CallToolParams{Name: "list_accounts", Arguments: map[string]any{}})
	if err != nil || res.IsError {
		t.Fatalf("call: %v %+v", err, res)
	}
	want, err := h.App.Tools.Call(auth.WithUserID(t.Context(), h.OwnerID()), "list_accounts", json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	structured, _ := json.Marshal(res.StructuredContent)
	var a, b any
	_ = json.Unmarshal(structured, &a)
	_ = json.Unmarshal(want.Content, &b)
	text := resultText(t, res)
	var c any
	_ = json.Unmarshal([]byte(text), &c)
	if !jsonEqual(a, b) || !jsonEqual(c, b) {
		t.Fatalf("structured = %s, text = %s, want %s", structured, text, want.Content)
	}
	if strings.Contains(text, "Bobs secret") || !strings.Contains(text, "Mine") {
		t.Fatalf("list_accounts = %s", text)
	}
	// X19: one line per call, without arguments or results.
	var line string
	for _, l := range strings.Split(h.Logs(), "\n") {
		if strings.Contains(l, `msg="mcp call"`) {
			line = l
		}
	}
	for _, want := range []string{"token_id=", "user_id=", "tool=list_accounts", "effect=read_only", "outcome=ok", "duration=", "bytes="} {
		if !strings.Contains(line, want) {
			t.Fatalf("mcp call log = %q, want %q", line, want)
		}
	}
	if strings.Contains(line, "Mine") {
		t.Fatalf("mcp call log holds the result: %q", line)
	}
}

func jsonEqual(a, b any) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return bytes.Equal(x, y)
}

// X17, X14, Review Focus 2: a write token records without a proposal; a read token cannot, by any path.
func TestMCPWriteTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	args := map[string]any{"date": "2026-10-23", "description": "Lunch", "amount": "45.90", "from_account_id": checking, "to_account_id": food}
	count := func() int {
		var page struct {
			Items []json.RawMessage `json:"items"`
		}
		h.MustDo(http.MethodGet, "/api/v1/transactions", nil, http.StatusOK, &page)
		return len(page.Items)
	}

	res, err := mcpSession(t, h, mcpToken(t, h, h.Client, "read")).CallTool(t.Context(), &mcp.CallToolParams{Name: "record_transaction", Arguments: args})
	if err != nil || !res.IsError || !strings.Contains(resultText(t, res), `"code":"tool_not_allowed"`) || count() != 0 {
		t.Fatalf("read token: %v %+v, transactions %d", err, res, count())
	}

	res, err = mcpSession(t, h, mcpToken(t, h, h.Client, "write")).CallTool(t.Context(), &mcp.CallToolParams{Name: "record_transaction", Arguments: args})
	if err != nil || res.IsError || count() != 1 {
		t.Fatalf("write token: %v %+v, transactions %d", err, res, count())
	}
}

// X2, X3, X11, X13, Review Focus 1, 3 and 4.
func TestMCPAuthentication(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	token := mcpToken(t, h, h.Client, "read")
	expired := mcpToken(t, h, h.Client, "read")
	if _, err := h.Pool.Exec(t.Context(), `UPDATE identity_access_token SET created_at = now() - interval '2 days',
		expires_at = now() - interval '1 day' WHERE token_hash = sha256($1::bytea)`, []byte(expired)); err != nil {
		t.Fatal(err)
	}
	deleted := mcpToken(t, h, h.Client, "read")
	mcpSession(t, h, deleted) // the token works before its deletion
	var id string
	if err := h.Pool.QueryRow(t.Context(), `SELECT id FROM identity_access_token WHERE token_hash = sha256($1::bytea)`, []byte(deleted)).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if r := h.Call(h.Client, http.MethodDelete, "/api/v1/access-tokens/"+id, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete: %d", r.Status)
	}
	auth := func(tok string) map[string]string { return map[string]string{"Authorization": "Bearer " + tok} }
	for name, hdr := range map[string]map[string]string{
		"no header": nil, "unknown token": auth("eqt_unknown"), "expired token": auth(expired), "deleted token": auth(deleted),
	} {
		r := rawMCP(t, h, http.MethodPost, "/mcp", hdr, initialize)
		if r.Status != http.StatusUnauthorized || !strings.HasPrefix(r.Header.Get("WWW-Authenticate"), "Bearer") {
			t.Errorf("%s: status %d, WWW-Authenticate %q", name, r.Status, r.Header.Get("WWW-Authenticate"))
		}
	}
	if r := rawMCP(t, h, http.MethodPost, "/mcp?token="+token, nil, initialize); r.Status != http.StatusUnauthorized {
		t.Errorf("query token: status %d", r.Status)
	}
	if r := h.Call(h.Client, http.MethodPost, "/mcp", json.RawMessage(initialize)); r.Status != http.StatusUnauthorized {
		t.Errorf("session cookie: status %d", r.Status)
	}
	if r := rawMCP(t, h, http.MethodPost, "/mcp", map[string]string{"Authorization": "Bearer " + token, "Origin": "https://evil.example"}, initialize); r.Status != http.StatusForbidden {
		t.Errorf("foreign origin: status %d", r.Status)
	}
	if r := rawMCP(t, h, http.MethodPost, "/mcp", map[string]string{"Authorization": "Bearer " + token, "Origin": h.URL()}, initialize); r.Status != http.StatusOK {
		t.Errorf("own origin: status %d: %s", r.Status, r.Body)
	}
	if r := rawMCP(t, h, http.MethodPost, "/mcp", map[string]string{"Authorization": "Bearer " + token, "Host": "finance.example.com"}, initialize); r.Status != http.StatusOK {
		t.Errorf("proxied host: status %d: %s", r.Status, r.Body)
	}
	big := append([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"pad":"`), bytes.Repeat([]byte("x"), 1<<20)...)
	if r := rawMCP(t, h, http.MethodPost, "/mcp", auth(token), append(big, `"}}`...)); r.Status != http.StatusRequestEntityTooLarge {
		t.Errorf("body over 1 MiB: status %d", r.Status)
	}
	r := rawMCP(t, h, http.MethodGet, "/mcp", auth(token), nil)
	if r.Status != http.StatusMethodNotAllowed || strings.Contains(string(r.Body), "<html") {
		t.Errorf("GET with token: status %d", r.Status)
	}
	if r := h.Call(h.Client, http.MethodGet, "/mcp", nil); r.Status != http.StatusUnauthorized || strings.Contains(string(r.Body), "<html") {
		t.Errorf("GET with cookie: status %d", r.Status)
	}
}

// Review Focus 5: a result over the registry's limit reaches the client as a tool error.
func TestMCPResultTooLarge(t *testing.T) {
	t.Parallel()
	type in struct{}
	type out struct {
		Text string `json:"text"`
	}
	big := tool.New(tool.Spec{Name: "big_result", Description: "Returns 40 KiB.", Effect: tool.ReadOnly},
		func(context.Context, int64, in) (out, error) { return out{Text: strings.Repeat("x", 40<<10)}, nil })
	h := apitest.New(t, apitest.ExtraTools(tool.Group{Tools: []tool.Tool{big}}))
	res, err := mcpSession(t, h, mcpToken(t, h, h.Client, "read")).CallTool(t.Context(), &mcp.CallToolParams{Name: "big_result", Arguments: map[string]any{}})
	if err != nil || !res.IsError || !strings.Contains(resultText(t, res), `"code":"result_too_large"`) {
		t.Fatalf("big result: %v %+v", err, res)
	}
}

// E10: the client receives the guide's MCP rendering as its instructions.
func TestMCPInstructions(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	s := mcpSession(t, h, mcpToken(t, h, h.Client, "read"))
	if got := s.InitializeResult().Instructions; got != assistant.Instructions() {
		t.Fatalf("instructions = %q", got)
	}
	if !slices.Contains([]string{"2026-07-28", "2025-11-25"}, s.InitializeResult().ProtocolVersion) {
		t.Fatalf("protocol = %s", s.InitializeResult().ProtocolVersion)
	}
}
