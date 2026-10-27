package aistudio_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
	if got := aistudio.New("http://x", "k", http.DefaultClient).Name(); got != "aistudio" {
		t.Fatalf("Name() = %q, want aistudio", got)
	}
}

func TestModels(t *testing.T) {
	t.Parallel()
	var got received
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = received{method: r.Method, path: r.URL.Path, key: r.Header.Get("x-goog-api-key")}
		_, _ = io.WriteString(w, `{"models":[`+
			`{"name":"models/gemini-b","supportedGenerationMethods":["generateContent","countTokens"]},`+
			`{"name":"models/embed","supportedGenerationMethods":["embedContent"]},`+
			`{"name":"models/gemini-a","supportedGenerationMethods":["generateContent"]}]}`)
	}))
	t.Cleanup(srv.Close)
	models, err := aistudio.New(srv.URL, "k", http.DefaultClient).Models(context.Background())
	if err != nil {
		t.Fatalf("Models: %v", err)
	}
	if got.method != http.MethodGet || got.path != "/v1beta/models" || got.key != "k" {
		t.Fatalf("request = %+v", got)
	}
	if !reflect.DeepEqual(models, []string{"gemini-a", "gemini-b"}) {
		t.Fatalf("models = %v, want [gemini-a gemini-b]", models)
	}
}

func TestGenerateToolChoiceNone(t *testing.T) {
	t.Parallel()
	tools := []llm.Tool{{Name: "f", Parameters: json.RawMessage(`{"type":"object"}`)}}
	for _, tt := range []struct {
		choice llm.ToolChoice
		want   bool
	}{{llm.ToolChoiceNone, true}, {llm.ToolChoiceAuto, false}} {
		var got received
		srv := serve(t, http.StatusOK, "text.json", &got)
		_, err := aistudio.New(srv.URL, "k", http.DefaultClient).Generate(context.Background(), "m1",
			llm.Request{Messages: []llm.Message{user("hi")}, Tools: tools, ToolChoice: tt.choice})
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		has := strings.Contains(string(got.body), `"toolConfig":{"functionCallingConfig":{"mode":"NONE"}}`)
		if has != tt.want || (!tt.want && strings.Contains(string(got.body), "toolConfig")) {
			t.Fatalf("choice %q: body %s", tt.choice, got.body)
		}
	}
}

// sse starts a fake Gemini API that answers with status and frames as server-sent events.
func sse(t *testing.T, status int, frames []string, got *received) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		*got = received{method: r.Method, path: r.URL.Path, key: r.Header.Get("x-goog-api-key"), query: r.URL.RawQuery, body: b}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(status)
		for _, f := range frames {
			_, _ = io.WriteString(w, "data: "+f+"\r\n\r\n")
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

// Design 2026-10-26 E2.
func TestStream(t *testing.T) {
	t.Parallel()
	text := func(s, finish string) string {
		f := `{"candidates":[{"content":{"role":"model","parts":[{"text":` + strings.TrimSpace(mustJSON(s)) + `}]}`
		if finish != "" {
			f += `,"finishReason":"` + finish + `"`
		}
		return f + `}]}`
	}
	tests := []struct {
		name   string
		status int
		frames []string
		check  func(t *testing.T, resp llm.Response, chunks []string, err error)
	}{
		{
			name:   "text",
			status: 200,
			frames: []string{text("A", ""), text("B", ""),
				`{"candidates":[{"content":{"role":"model","parts":[{"text":"C"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":3,"thoughtsTokenCount":2}}`},
			check: func(t *testing.T, resp llm.Response, chunks []string, err error) {
				if err != nil || !reflect.DeepEqual(chunks, []string{"A", "B", "C"}) || len(resp.Message.Parts) != 1 ||
					resp.Text() != "ABC" || resp.Usage != (llm.Usage{InputTokens: 7, OutputTokens: 5}) || resp.FinishReason != llm.FinishStop {
					t.Fatalf("resp = %+v, chunks = %v, err = %v", resp, chunks, err)
				}
			},
		},
		{
			name:   "function call with signature",
			status: 200,
			frames: []string{`{"candidates":[{"content":{"role":"model","parts":[{"functionCall":{"name":"get_x","args":{}},"thoughtSignature":"AQI="}]},"finishReason":"STOP"}]}`},
			check: func(t *testing.T, resp llm.Response, chunks []string, err error) {
				p := resp.Message.Parts
				if err != nil || len(p) != 1 || p[0].ToolCall == nil || p[0].ToolCall.Name != "get_x" || p[0].Signature == nil ||
					!reflect.DeepEqual(p[0].Signature.Data, []byte{1, 2}) || resp.FinishReason != llm.FinishToolCalls || len(chunks) != 0 {
					t.Fatalf("resp = %+v, err = %v", resp, err)
				}
			},
		},
		{
			name:   "signature on the last empty text part",
			status: 200,
			frames: []string{text("Hi", ""), `{"candidates":[{"content":{"role":"model","parts":[{"text":"","thoughtSignature":"AQI="}]},"finishReason":"STOP"}]}`},
			check: func(t *testing.T, resp llm.Response, chunks []string, err error) {
				p := resp.Message.Parts
				if err != nil || len(p) != 1 || p[0].Text != "Hi" || p[0].Signature == nil || !reflect.DeepEqual(p[0].Signature.Data, []byte{1, 2}) {
					t.Fatalf("resp = %+v, err = %v", resp, err)
				}
			},
		},
		{
			// Review Focus 1: a stream cut before its last chunk is not a finished answer.
			name:   "no finish reason",
			status: 200,
			frames: []string{text("A", ""), text("B", "")},
			check: func(t *testing.T, _ llm.Response, _ []string, err error) {
				if !errors.Is(err, llm.ErrTransient) {
					t.Fatalf("err = %v, want ErrTransient", err)
				}
			},
		},
		{
			name:   "quota",
			status: 429,
			check: func(t *testing.T, _ llm.Response, _ []string, err error) {
				if _, ok := errors.AsType[*llm.QuotaError](err); !ok {
					t.Fatalf("err = %v, want QuotaError", err)
				}
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			var got received
			srv := sse(t, tt.status, tt.frames, &got)
			var chunks []string
			resp, err := aistudio.New(srv.URL, "k", srv.Client()).Stream(context.Background(), "m",
				llm.Request{Messages: []llm.Message{user("oi")}}, func(s string) { chunks = append(chunks, s) })
			if got.path != "/v1beta/models/m:streamGenerateContent" || got.query != "alt=sse" || got.key != "k" {
				t.Fatalf("request = %s ? %s, key %q", got.path, got.query, got.key)
			}
			tt.check(t, resp, chunks, err)
		})
	}
}

func mustJSON(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// Design 2026-10-26 E14: low thinking maps to thinkingLevel LOW (ai.google.dev/api/generate-content#ThinkingLevel).
func TestThinkingWire(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		thinking string
		want     any
	}{{"low", map[string]any{"thinkingLevel": "LOW"}}, {"", nil}} {
		var got received
		srv := serve(t, 200, "text.json", &got)
		if _, err := aistudio.New(srv.URL, "k", srv.Client()).Generate(context.Background(), "m",
			llm.Request{Messages: []llm.Message{user("oi")}, Thinking: tt.thinking}); err != nil {
			t.Fatal(err)
		}
		cfg, _ := decode(t, got.body)["generationConfig"].(map[string]any)
		if !reflect.DeepEqual(cfg["thinkingConfig"], tt.want) {
			t.Fatalf("Thinking %q: generationConfig = %v, want thinkingConfig %v", tt.thinking, cfg, tt.want)
		}
	}
}
