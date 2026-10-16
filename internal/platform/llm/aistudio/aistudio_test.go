package aistudio_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
)

// received is what the fake Gemini API saw of one request.
type received struct {
	method, path, key, query string
	body                     []byte
}

// serve starts a fake Gemini API that answers every request with status and the body of
// testdata/fixture, recording the request into got.
func serve(t *testing.T, status int, fixture string, got *received) *httptest.Server {
	t.Helper()
	body, err := os.ReadFile("testdata/" + fixture)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if got != nil {
			*got = received{method: r.Method, path: r.URL.Path, key: r.Header.Get("x-goog-api-key"), query: r.URL.RawQuery, body: b}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func user(s string) llm.Message {
	return llm.Message{Role: llm.RoleUser, Parts: []llm.Part{{Text: s}}}
}

func decode(t *testing.T, b []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("decode %s: %v", b, err)
	}
	return m
}

func TestGenerateRequest(t *testing.T) {
	temperature := 0.2
	call := llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{"account":"x"}`)}
	tests := []struct {
		name string
		req  llm.Request
		want string
	}{
		{
			name: "system and user text",
			req:  llm.Request{System: "S", Messages: []llm.Message{user("hi")}},
			want: `{"systemInstruction":{"parts":[{"text":"S"}]},"contents":[{"role":"user","parts":[{"text":"hi"}]}]}`,
		},
		{
			name: "schema and limits",
			req: llm.Request{
				Messages: []llm.Message{user("hi")}, Schema: json.RawMessage(`{"type":"object"}`),
				MaxOutputTokens: 256, Temperature: &temperature,
			},
			want: `{"contents":[{"role":"user","parts":[{"text":"hi"}]}],"generationConfig":{"responseMimeType":"application/json","responseJsonSchema":{"type":"object"},"maxOutputTokens":256,"temperature":0.2}}`,
		},
		{
			name: "tools",
			req: llm.Request{
				Messages: []llm.Message{user("hi")},
				Tools:    []llm.Tool{{Name: "balance", Description: "d", Parameters: json.RawMessage(`{"type":"object"}`)}},
			},
			want: `{"contents":[{"role":"user","parts":[{"text":"hi"}]}],"tools":[{"functionDeclarations":[{"name":"balance","description":"d","parametersJsonSchema":{"type":"object"}}]}]}`,
		},
		{
			name: "history with signatures and a tool result",
			req: llm.Request{Messages: []llm.Message{
				user("hi"),
				{Role: llm.RoleModel, Parts: []llm.Part{
					{ToolCall: &call, Signature: &llm.Signature{Provider: "aistudio", Data: []byte("sig")}},
					{Text: "note", Signature: &llm.Signature{Provider: "other", Data: []byte("x")}},
				}},
				{Role: llm.RoleTool, Parts: []llm.Part{{ToolResult: &llm.ToolResult{
					CallID: "c1", Name: "balance", Content: json.RawMessage(`{"amount":"10.00"}`),
				}}}},
			}},
			want: `{"contents":[
				{"role":"user","parts":[{"text":"hi"}]},
				{"role":"model","parts":[{"functionCall":{"id":"c1","name":"balance","args":{"account":"x"}},"thoughtSignature":"c2ln"},{"text":"note"}]},
				{"role":"user","parts":[{"functionResponse":{"id":"c1","name":"balance","response":{"amount":"10.00"}}}]}]}`,
		},
		{
			name: "tool result that is not an object",
			req: llm.Request{Messages: []llm.Message{{Role: llm.RoleTool, Parts: []llm.Part{{ToolResult: &llm.ToolResult{
				CallID: "c1", Name: "balance", Content: json.RawMessage(`"ok"`),
			}}}}}},
			want: `{"contents":[{"role":"user","parts":[{"functionResponse":{"id":"c1","name":"balance","response":{"result":"ok"}}}]}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got received
			srv := serve(t, http.StatusOK, "text.json", &got)
			p := aistudio.New(srv.URL, "k", srv.Client())
			if _, err := p.Generate(context.Background(), "gemini-x", tt.req); err != nil {
				t.Fatalf("Generate: %v", err)
			}
			if got.method != http.MethodPost || got.path != "/v1beta/models/gemini-x:generateContent" || got.key != "k" || got.query != "" {
				t.Fatalf("request = %s %s?%s key %q", got.method, got.path, got.query, got.key)
			}
			if body, want := decode(t, got.body), decode(t, []byte(tt.want)); !reflect.DeepEqual(body, want) {
				t.Fatalf("body = %s\nwant %s", got.body, tt.want)
			}
		})
	}
}

func TestGenerateResponse(t *testing.T) {
	tests := []struct {
		fixture string
		want    llm.Response
	}{
		{
			fixture: "text.json",
			want: llm.Response{
				Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: "Olá"}}},
				FinishReason: llm.FinishStop,
				Usage:        llm.Usage{InputTokens: 7, OutputTokens: 5},
			},
		},
		{
			fixture: "function_call.json",
			want: llm.Response{
				Message: llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{
					ToolCall:  &llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{"account":"x"}`)},
					Signature: &llm.Signature{Provider: "aistudio", Data: []byte("sig")},
				}}},
				FinishReason: llm.FinishToolCalls,
				Usage:        llm.Usage{InputTokens: 20, OutputTokens: 4},
			},
		},
		{
			fixture: "thought_part.json",
			want: llm.Response{
				Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: "a"}}},
				FinishReason: llm.FinishStop,
			},
		},
		{
			fixture: "max_tokens.json",
			want: llm.Response{
				Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: `{"a":`}}},
				FinishReason: llm.FinishLength,
			},
		},
		{
			fixture: "safety.json",
			want:    llm.Response{Message: llm.Message{Role: llm.RoleModel}, FinishReason: llm.FinishBlocked},
		},
		{
			fixture: "prompt_blocked.json",
			want:    llm.Response{Message: llm.Message{Role: llm.RoleModel}, FinishReason: llm.FinishBlocked},
		},
		{
			fixture: "empty.json",
			want:    llm.Response{Message: llm.Message{Role: llm.RoleModel}, FinishReason: llm.FinishOther},
		},
	}
	for _, tt := range tests {
		t.Run(tt.fixture, func(t *testing.T) {
			srv := serve(t, http.StatusOK, tt.fixture, nil)
			got, err := aistudio.New(srv.URL, "k", srv.Client()).Generate(context.Background(), "gemini-x", llm.Request{Messages: []llm.Message{user("hi")}})
			if err != nil {
				t.Fatalf("Generate: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("response = %+v\nwant %+v", got, tt.want)
			}
		})
	}
}

func TestName(t *testing.T) {
	if got := aistudio.New("http://x", "k", http.DefaultClient).Name(); got != "aistudio" {
		t.Fatalf("Name() = %q, want aistudio", got)
	}
}
