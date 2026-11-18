package anthropic_test

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
	"github.com/andrelopes-code/equori/internal/platform/llm/anthropic"
)

const thinkingBlock = `{"type":"thinking","thinking":"","signature":"sig-1"}`

func TestGenerateSendsTheMessagesRequest(t *testing.T) {
	t.Parallel()

	var got received
	srv := serve(t, http.StatusOK, nil, `{"content":[],"stop_reason":"end_turn"}`, &got)
	req := llm.Request{
		System: "be brief",
		Messages: []llm.Message{
			user("balance?"),
			{Role: llm.RoleModel, Parts: []llm.Part{
				{Signature: &llm.Signature{Provider: "anthropic", Data: []byte(thinkingBlock)}},
				{Signature: &llm.Signature{Provider: "aistudio", Data: []byte("other")}},
				{Text: "checking"},
				{ToolCall: &llm.ToolCall{ID: "c1", Name: "accounts", Args: nil}},
			}},
			{Role: llm.RoleTool, Parts: []llm.Part{{ToolResult: &llm.ToolResult{
				CallID:  "c1",
				Name:    "accounts",
				Content: json.RawMessage(`{"total":10}`),
				IsError: true,
			}}}},
		},
		Tools: []llm.Tool{{
			Name:        "accounts",
			Description: "lists accounts",
			Parameters:  json.RawMessage(`{"type":"object"}`),
		}},
		Temperature: new(0.2),
	}

	_, err := anthropic.New(srv.URL+"/v1/", "k", srv.Client()).Generate(
		context.Background(),
		"claude-a",
		req,
	)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	if got.method != http.MethodPost || got.path != "/v1/messages" ||
		got.key != "k" || got.version != "2023-06-01" || got.auth != "" {
		t.Fatalf("request = %+v", got)
	}

	want := `{
		"model": "claude-a",
		"max_tokens": 16000,
		"system": "be brief",
		"cache_control": {"type": "ephemeral"},
		"messages": [
			{"role": "user", "content": [{"type": "text", "text": "balance?"}]},
			{"role": "assistant", "content": [
				` + thinkingBlock + `,
				{"type": "text", "text": "checking"},
				{"type": "tool_use", "id": "c1", "name": "accounts", "input": {}}
			]},
			{"role": "user", "content": [{
				"type": "tool_result",
				"tool_use_id": "c1",
				"content": "{\"total\":10}",
				"is_error": true
			}]}
		],
		"tools": [{
			"name": "accounts",
			"description": "lists accounts",
			"input_schema": {"type": "object"}
		}]
	}`
	assertBody(t, got.body, want)
}

func TestGenerateOptions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		req  llm.Request
		want string
	}{
		{
			name: "low thinking is low effort",
			req:  llm.Request{Thinking: "low"},
			want: `{"output_config": {"effort": "low"}}`,
		},
		{
			name: "a schema is the output format",
			req:  llm.Request{Schema: json.RawMessage(`{"type":"object"}`)},
			want: `{"output_config": {"format": {"type": "json_schema", "schema": {"type": "object"}}}}`,
		},
		{
			name: "tool choice none keeps the tools",
			req: llm.Request{
				Tools:      []llm.Tool{{Name: "t", Description: "d"}},
				ToolChoice: llm.ToolChoiceNone,
			},
			want: `{
				"tools": [{"name": "t", "description": "d", "input_schema": {"type": "object"}}],
				"tool_choice": {"type": "none"}
			}`,
		},
		{
			name: "an output limit is max_tokens",
			req:  llm.Request{MaxOutputTokens: 300},
			want: `{"max_tokens": 300}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var got received
			srv := serve(t, http.StatusOK, nil, `{"content":[],"stop_reason":"end_turn"}`, &got)
			tt.req.Messages = []llm.Message{user("hi")}

			_, err := anthropic.New(srv.URL, "k", srv.Client()).Generate(
				context.Background(),
				"claude-a",
				tt.req,
			)
			if err != nil {
				t.Fatalf("Generate: %v", err)
			}

			var want map[string]any
			if err := json.Unmarshal([]byte(tt.want), &want); err != nil {
				t.Fatal(err)
			}

			for key, value := range want {
				if !reflect.DeepEqual(got.body[key], value) {
					t.Errorf("%s = %v, want %v", key, got.body[key], value)
				}
			}
		})
	}
}

func TestGenerateReadsTheAnswer(t *testing.T) {
	t.Parallel()

	body := `{
		"content": [
			` + thinkingBlock + `,
			{"type": "text", "text": "two accounts"},
			{"type": "tool_use", "id": "c2", "name": "accounts", "input": {"open": true}}
		],
		"stop_reason": "tool_use",
		"usage": {
			"input_tokens": 5,
			"cache_creation_input_tokens": 20,
			"cache_read_input_tokens": 300,
			"output_tokens": 7
		}
	}`
	srv := serve(t, http.StatusOK, nil, body, nil)

	resp, err := anthropic.New(srv.URL, "k", srv.Client()).Generate(
		context.Background(),
		"claude-a",
		llm.Request{Messages: []llm.Message{user("hi")}},
	)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	assertAnswer(t, resp)
}

func TestGenerateFinishReason(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stop string
		want llm.FinishReason
	}{
		{stop: "end_turn", want: llm.FinishStop},
		{stop: "stop_sequence", want: llm.FinishStop},
		{stop: "max_tokens", want: llm.FinishLength},
		{stop: "refusal", want: llm.FinishBlocked},
		{stop: "pause_turn", want: llm.FinishOther},
	}
	for _, tt := range tests {
		t.Run(tt.stop, func(t *testing.T) {
			t.Parallel()

			body := `{"content":[{"type":"text","text":"x"}],"stop_reason":"` + tt.stop + `"}`
			srv := serve(t, http.StatusOK, nil, body, nil)

			resp, err := anthropic.New(srv.URL, "k", srv.Client()).Generate(
				context.Background(),
				"claude-a",
				llm.Request{Messages: []llm.Message{user("hi")}},
			)
			if err != nil {
				t.Fatalf("Generate: %v", err)
			}

			if resp.FinishReason != tt.want {
				t.Fatalf("finish = %q, want %q", resp.FinishReason, tt.want)
			}
		})
	}
}

func TestGenerateClassifiesFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status int
		header http.Header
		want   error
		retry  time.Duration
	}{
		{
			status: 429,
			header: http.Header{"Retry-After": {"7"}},
			want:   llm.ErrQuota,
			retry:  7 * time.Second,
		},
		{status: 401, want: llm.ErrUnauthorized},
		{status: 403, want: llm.ErrUnauthorized},
		{status: 400, want: llm.ErrInvalidRequest},
		{status: 404, want: llm.ErrInvalidRequest},
		{status: 413, want: llm.ErrInvalidRequest},
		{status: 500, want: llm.ErrTransient},
		{status: 529, want: llm.ErrTransient},
	}
	for _, tt := range tests {
		t.Run(http.StatusText(tt.status), func(t *testing.T) {
			t.Parallel()

			srv := serve(t, tt.status, tt.header, `{"error":{"message":"secret prompt"}}`, nil)

			_, err := anthropic.New(srv.URL, "k", srv.Client()).Generate(
				context.Background(),
				"claude-a",
				llm.Request{Messages: []llm.Message{user("hi")}},
			)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}

			if strings.Contains(err.Error(), "secret prompt") {
				t.Fatalf("err = %v, carries the response body", err)
			}

			if qe, ok := errors.AsType[*llm.QuotaError](err); ok && qe.RetryAfter != tt.retry {
				t.Fatalf("retry after = %s, want %s", qe.RetryAfter, tt.retry)
			}
		})
	}
}

func TestStreamAccumulatesTheAnswer(t *testing.T) {
	t.Parallel()

	var got received
	srv := serve(t, http.StatusOK, nil, sse(
		`{"type":"message_start","message":{"usage":{"input_tokens":5,"cache_creation_input_tokens":20,"cache_read_input_tokens":300,"output_tokens":1}}}`,
		`{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig-1"}}`,
		`{"type":"content_block_stop","index":0}`,
		`{"type":"ping"}`,
		`{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}`,
		`{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"two "}}`,
		`{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"accounts"}}`,
		`{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"c2","name":"accounts","input":{}}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\"open\":"}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":" true}"}}`,
		`{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":7}}`,
		`{"type":"message_stop"}`,
	), &got)

	var chunks []string

	resp, err := anthropic.New(srv.URL, "k", srv.Client()).Stream(
		context.Background(),
		"claude-a",
		llm.Request{Messages: []llm.Message{user("hi")}},
		func(s string) { chunks = append(chunks, s) },
	)
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	if got.body["stream"] != true {
		t.Fatalf("stream = %v, want true", got.body["stream"])
	}

	if !slices.Equal(chunks, []string{"two ", "accounts"}) {
		t.Fatalf("chunks = %q", chunks)
	}

	assertAnswer(t, resp)
}

func TestStreamClassifiesFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		events []string
	}{
		{
			name: "a stream cut before its stop reason",
			events: []string{
				`{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
				`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"two"}}`,
			},
		},
		{
			name: "an error event",
			events: []string{
				`{"type":"error","error":{"type":"overloaded_error","message":"busy"}}`,
				`{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}`,
			},
		},
		{
			name: "a block index out of range",
			events: []string{
				`{"type":"content_block_start","index":100000,"content_block":{"type":"text","text":""}}`,
				`{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}`,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			srv := serve(t, http.StatusOK, nil, sse(tt.events...), nil)

			_, err := anthropic.New(srv.URL, "k", srv.Client()).Stream(
				context.Background(),
				"claude-a",
				llm.Request{Messages: []llm.Message{user("hi")}},
				func(string) {},
			)
			if !errors.Is(err, llm.ErrTransient) {
				t.Fatalf("err = %v, want %v", err, llm.ErrTransient)
			}
		})
	}
}

func TestModels(t *testing.T) {
	t.Parallel()

	var got received
	srv := serve(
		t,
		http.StatusOK,
		nil,
		`{"data":[{"id":"claude-b"},{"id":"claude-a"},{"id":"claude-b"}]}`,
		&got,
	)

	models, err := anthropic.New(srv.URL+"/v1", "k", srv.Client()).Models(context.Background())
	if err != nil {
		t.Fatalf("Models: %v", err)
	}

	if got.method != http.MethodGet || got.path != "/v1/models" || got.key != "k" {
		t.Fatalf("request = %+v", got)
	}

	if !slices.Equal(models, []string{"claude-a", "claude-b"}) {
		t.Fatalf("models = %v, want [claude-a claude-b]", models)
	}
}

// received is what the fake API saw of one request.
type received struct {
	method, path, key, version, auth string
	body                             map[string]any
}

// serve starts a fake Messages API that answers every request with status, header and body,
// recording the request into got.
func serve(
	t *testing.T,
	status int,
	header http.Header,
	body string,
	got *received,
) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got != nil {
			b, _ := io.ReadAll(r.Body)

			*got = received{
				method:  r.Method,
				path:    r.URL.Path,
				key:     r.Header.Get("X-Api-Key"),
				version: r.Header.Get("Anthropic-Version"),
				auth:    r.Header.Get("Authorization"),
			}
			if len(b) > 0 {
				if err := json.Unmarshal(b, &got.body); err != nil {
					t.Errorf("request body %s: %v", b, err)
				}
			}
		}

		for k, v := range header {
			w.Header()[k] = v
		}

		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)

	return srv
}

func sse(events ...string) string {
	var b strings.Builder
	for _, e := range events {
		b.WriteString("event: x\ndata: ")
		b.WriteString(e)
		b.WriteString("\n\n")
	}

	return b.String()
}

func user(s string) llm.Message {
	return llm.Message{Role: llm.RoleUser, Parts: []llm.Part{{Text: s}}}
}

func assertBody(t *testing.T, got map[string]any, wantJSON string) {
	t.Helper()

	var want map[string]any
	if err := json.Unmarshal([]byte(wantJSON), &want); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(got, want) {
		g, _ := json.MarshalIndent(got, "", " ")
		w, _ := json.MarshalIndent(want, "", " ")
		t.Fatalf("body =\n%s\nwant\n%s", g, w)
	}
}

// assertAnswer checks the answer both Generate and Stream build from the same content: the
// thinking block as a signature, the text, the tool call and the whole prompt as input.
func assertAnswer(t *testing.T, resp llm.Response) {
	t.Helper()

	if resp.FinishReason != llm.FinishToolCalls {
		t.Fatalf("finish = %q, want %q", resp.FinishReason, llm.FinishToolCalls)
	}

	if resp.Usage != (llm.Usage{InputTokens: 325, OutputTokens: 7}) {
		t.Fatalf("usage = %+v, want 325 in and 7 out", resp.Usage)
	}

	parts := resp.Message.Parts
	if resp.Message.Role != llm.RoleModel || len(parts) != 3 {
		t.Fatalf("message = %+v", resp.Message)
	}

	sig := parts[0].Signature
	if sig == nil || sig.Provider != "anthropic" {
		t.Fatalf("part 0 = %+v, want an anthropic signature", parts[0])
	}

	var block map[string]string
	if err := json.Unmarshal(sig.Data, &block); err != nil {
		t.Fatalf("signature %s: %v", sig.Data, err)
	}

	wantBlock := map[string]string{"type": "thinking", "thinking": "", "signature": "sig-1"}
	if !reflect.DeepEqual(block, wantBlock) {
		t.Fatalf("thinking block = %v, want %v", block, wantBlock)
	}

	if parts[1].Text != "two accounts" || resp.Text() != "two accounts" {
		t.Fatalf("text = %q, want %q", resp.Text(), "two accounts")
	}

	call := parts[2].ToolCall
	if call == nil || call.ID != "c2" || call.Name != "accounts" {
		t.Fatalf("part 2 = %+v, want the accounts call", parts[2])
	}

	var args map[string]bool
	if err := json.Unmarshal(call.Args, &args); err != nil || !args["open"] {
		t.Fatalf("args = %s (%v), want open true", call.Args, err)
	}
}

// Assistant parity design F6: an image travels as an image block, a PDF and plain text as
// document blocks; another media type fails before the call.
func TestGenerateSendsFiles(t *testing.T) {
	t.Parallel()

	var got received
	srv := serve(t, http.StatusOK, nil, `{"content":[],"stop_reason":"end_turn"}`, &got)
	p := anthropic.New(srv.URL+"/v1/", "k", srv.Client())

	req := llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{
		{Text: "see"},
		{File: &llm.File{MediaType: "image/png", Data: []byte("png")}},
		{File: &llm.File{MediaType: "application/pdf", Data: []byte("pdf")}},
		{File: &llm.File{MediaType: "text/plain", Data: []byte("note")}},
	}}}}

	if _, err := p.Generate(context.Background(), "claude-a", req); err != nil {
		t.Fatalf("Generate: %v", err)
	}

	assertBody(t, got.body, `{
		"model": "claude-a",
		"max_tokens": 16000,
		"cache_control": {"type": "ephemeral"},
		"messages": [{"role": "user", "content": [
			{"type": "text", "text": "see"},
			{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "cG5n"}},
			{"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": "cGRm"}},
			{"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": "note"}}
		]}]
	}`)

	gif := llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{
		{File: &llm.File{MediaType: "image/heic", Data: []byte("x")}},
	}}}}
	if _, err := p.Generate(
		context.Background(),
		"claude-a",
		gif,
	); !errors.Is(
		err,
		llm.ErrFileUnsupported,
	) {
		t.Errorf("Generate of image/heic = %v, want ErrFileUnsupported", err)
	}
}
