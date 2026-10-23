package openai_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/openai"
)

// received is what the fake API saw of one request.
type received struct {
	method, path, auth string
	body               map[string]any
}

// serve starts a fake chat completions API that answers every request with status, header
// and body, recording the request into got.
func serve(t *testing.T, status int, header http.Header, body string, got *received) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got != nil {
			b, _ := io.ReadAll(r.Body)
			*got = received{method: r.Method, path: r.URL.Path, auth: r.Header.Get("Authorization")}
			if len(b) > 0 {
				if err := json.Unmarshal(b, &got.body); err != nil {
					t.Errorf("request body %s: %v", b, err)
				}
			}
		}
		for k, v := range header {
			w.Header()[k] = v
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func user(s string) llm.Message {
	return llm.Message{Role: llm.RoleUser, Parts: []llm.Part{{Text: s}}}
}

func asJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

const textAnswer = `{"choices":[{"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],` +
	`"usage":{"prompt_tokens":3,"completion_tokens":1}}`

func TestGenerateText(t *testing.T) {
	t.Parallel()
	var got received
	srv := serve(t, http.StatusOK, nil, textAnswer, &got)
	temperature := 0.0
	resp, err := openai.New(srv.URL+"/v1", "k", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{
		System: "sys", Messages: []llm.Message{user("hi")}, MaxOutputTokens: 64, Temperature: &temperature,
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if got.method != http.MethodPost || got.path != "/v1/chat/completions" || got.auth != "Bearer k" {
		t.Fatalf("request = %s %s auth %q", got.method, got.path, got.auth)
	}
	want := `{"max_tokens":64,"messages":[{"content":"sys","role":"system"},{"content":"hi","role":"user"}],` +
		`"model":"m1","temperature":0}`
	if body := asJSON(t, got.body); body != want {
		t.Fatalf("body = %s\nwant   %s", body, want)
	}
	if resp.Text() != "ok" || resp.FinishReason != llm.FinishStop || resp.Usage != (llm.Usage{InputTokens: 3, OutputTokens: 1}) {
		t.Fatalf("response = %+v", resp)
	}
	if resp.Message.Role != llm.RoleModel {
		t.Fatalf("role = %s, want model", resp.Message.Role)
	}
}

func TestGenerateNoKey(t *testing.T) {
	t.Parallel()
	var got received
	srv := serve(t, http.StatusOK, nil, textAnswer, &got)
	if _, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: []llm.Message{user("hi")}}); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if got.auth != "" {
		t.Fatalf("Authorization = %q, want none", got.auth)
	}
}

func TestBaseURLSlash(t *testing.T) {
	t.Parallel()
	var got received
	srv := serve(t, http.StatusOK, nil, textAnswer, &got)
	if _, err := openai.New(srv.URL+"/v1/", "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: []llm.Message{user("hi")}}); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if got.path != "/v1/chat/completions" {
		t.Fatalf("path = %s, want /v1/chat/completions", got.path)
	}
}

func TestGenerateToolRoundTrip(t *testing.T) {
	t.Parallel()
	var got received
	answer := `{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"c2","type":"function",` +
		`"function":{"name":"g","arguments":"{\"y\":2}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}`
	srv := serve(t, http.StatusOK, nil, answer, &got)
	history := []llm.Message{
		user("go"),
		{Role: llm.RoleModel, Parts: []llm.Part{{ToolCall: &llm.ToolCall{ID: "c1", Name: "f", Args: json.RawMessage(`{"x":1}`)}}}},
		{Role: llm.RoleTool, Parts: []llm.Part{{ToolResult: &llm.ToolResult{CallID: "c1", Name: "f", Content: json.RawMessage(`{"r":true}`)}}}},
	}
	tools := []llm.Tool{{Name: "g", Description: "does g", Parameters: json.RawMessage(`{"type":"object"}`)}}
	resp, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: history, Tools: tools})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	want := `{"messages":[{"content":"go","role":"user"},` +
		`{"content":null,"role":"assistant","tool_calls":[{"function":{"arguments":"{\"x\":1}","name":"f"},"id":"c1","type":"function"}]},` +
		`{"content":"{\"r\":true}","role":"tool","tool_call_id":"c1"}],"model":"m1",` +
		`"tools":[{"function":{"description":"does g","name":"g","parameters":{"type":"object"}},"type":"function"}]}`
	if body := asJSON(t, got.body); body != want {
		t.Fatalf("body = %s\nwant   %s", body, want)
	}
	wantParts := []llm.Part{{ToolCall: &llm.ToolCall{ID: "c2", Name: "g", Args: json.RawMessage(`{"y":2}`)}}}
	if !reflect.DeepEqual(resp.Message.Parts, wantParts) || resp.FinishReason != llm.FinishToolCalls {
		t.Fatalf("response = %+v", resp)
	}
}

func TestGenerateSchema(t *testing.T) {
	t.Parallel()
	var got received
	srv := serve(t, http.StatusOK, nil, textAnswer, &got)
	req := llm.Request{Messages: []llm.Message{user("hi")}, Schema: json.RawMessage(`{"type":"object"}`)}
	if _, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", req); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	want := `{"json_schema":{"name":"answer","schema":{"type":"object"}},"type":"json_schema"}`
	if format := asJSON(t, got.body["response_format"]); format != want {
		t.Fatalf("response_format = %s, want %s", format, want)
	}
}

func TestGenerateFinishReason(t *testing.T) {
	t.Parallel()
	tests := map[string]llm.FinishReason{
		"stop": llm.FinishStop, "length": llm.FinishLength, "content_filter": llm.FinishBlocked, "other": llm.FinishOther,
	}
	for reason, want := range tests {
		t.Run(reason, func(t *testing.T) {
			t.Parallel()
			srv := serve(t, http.StatusOK, nil, `{"choices":[{"message":{"content":"x"},"finish_reason":"`+reason+`"}]}`, nil)
			resp, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: []llm.Message{user("hi")}})
			if err != nil {
				t.Fatalf("Generate: %v", err)
			}
			if resp.FinishReason != want {
				t.Fatalf("FinishReason = %s, want %s", resp.FinishReason, want)
			}
		})
	}
}

func TestGenerateStatus(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		status    int
		header    http.Header
		wantErr   error
		wantRetry time.Duration
	}{
		{name: "quota with delay", status: 429, header: http.Header{"Retry-After": {"7"}}, wantErr: llm.ErrQuota, wantRetry: 7 * time.Second},
		{name: "quota with date", status: 429, header: http.Header{"Retry-After": {"Wed, 21 Oct 2026 07:28:00 GMT"}}, wantErr: llm.ErrQuota},
		{name: "quota without header", status: 429, wantErr: llm.ErrQuota},
		{name: "unauthorized", status: 401, wantErr: llm.ErrUnauthorized},
		{name: "forbidden", status: 403, wantErr: llm.ErrUnauthorized},
		{name: "bad request", status: 400, wantErr: llm.ErrInvalidRequest},
		{name: "unknown model", status: 404, wantErr: llm.ErrInvalidRequest},
		{name: "too large", status: 413, wantErr: llm.ErrInvalidRequest},
		{name: "unprocessable", status: 422, wantErr: llm.ErrInvalidRequest},
		{name: "server error", status: 500, wantErr: llm.ErrTransient},
		{name: "unavailable", status: 503, wantErr: llm.ErrTransient},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			srv := serve(t, tt.status, tt.header, `{"error":{"message":"secret-body"}}`, nil)
			_, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: []llm.Message{user("hi")}})
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if strings.Contains(err.Error(), "secret-body") {
				t.Fatalf("err %q carries the response body", err)
			}
			if q, ok := errors.AsType[*llm.QuotaError](err); ok && q.RetryAfter != tt.wantRetry {
				t.Fatalf("RetryAfter = %s, want %s", q.RetryAfter, tt.wantRetry)
			}
		})
	}
}

func TestGenerateTransport(t *testing.T) {
	t.Parallel()
	srv := serve(t, http.StatusOK, nil, textAnswer, nil)
	srv.Close()
	_, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1", llm.Request{Messages: []llm.Message{user("hi")}})
	if !errors.Is(err, llm.ErrTransient) {
		t.Fatalf("err = %v, want ErrTransient", err)
	}
}

func TestModels(t *testing.T) {
	t.Parallel()
	var got received
	srv := serve(t, http.StatusOK, nil, `{"data":[{"id":"b"},{"id":"a"},{"id":"a"}]}`, &got)
	models, err := openai.New(srv.URL+"/v1", "k", http.DefaultClient).Models(context.Background())
	if err != nil {
		t.Fatalf("Models: %v", err)
	}
	if got.method != http.MethodGet || got.path != "/v1/models" || got.auth != "Bearer k" {
		t.Fatalf("request = %s %s auth %q", got.method, got.path, got.auth)
	}
	if !slices.Equal(models, []string{"a", "b"}) {
		t.Fatalf("models = %v, want [a b]", models)
	}
}

func TestModelsUnauthorized(t *testing.T) {
	t.Parallel()
	srv := serve(t, http.StatusUnauthorized, nil, `{}`, nil)
	if _, err := openai.New(srv.URL, "k", http.DefaultClient).Models(context.Background()); !errors.Is(err, llm.ErrUnauthorized) {
		t.Fatalf("err = %v, want ErrUnauthorized", err)
	}
}

func TestGenerateToolChoiceNone(t *testing.T) {
	t.Parallel()
	tools := []llm.Tool{{Name: "f", Parameters: json.RawMessage(`{"type":"object"}`)}}
	for _, tt := range []struct {
		choice llm.ToolChoice
		want   string
	}{{llm.ToolChoiceNone, "none"}, {llm.ToolChoiceAuto, ""}} {
		var got received
		srv := serve(t, http.StatusOK, nil, textAnswer, &got)
		_, err := openai.New(srv.URL, "", http.DefaultClient).Generate(context.Background(), "m1",
			llm.Request{Messages: []llm.Message{user("hi")}, Tools: tools, ToolChoice: tt.choice})
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		v, ok := got.body["tool_choice"]
		if tt.want == "" && ok || tt.want != "" && v != tt.want {
			t.Fatalf("choice %q: tool_choice = %v (present %v)", tt.choice, v, ok)
		}
	}
}
