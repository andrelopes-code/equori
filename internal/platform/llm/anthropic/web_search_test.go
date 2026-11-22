package anthropic_test

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/anthropic"
)

const (
	searchUse = `{"type":"server_tool_use","id":"srv1","name":"web_search",` +
		`"input":{"query":"claude shannon birth date"}}`
	searchResult = `{"type":"web_search_tool_result","tool_use_id":"srv1","content":[` +
		`{"type":"web_search_result","url":"https://example.org/shannon","title":"Shannon",` +
		`"encrypted_content":"enc-1"}]}`
	citedText = `{"type":"text","text":"He was born in 1916.","citations":[` +
		`{"type":"web_search_result_location","url":"https://example.org/shannon",` +
		`"title":"Shannon","encrypted_index":"idx-1","cited_text":"April 30, 1916"},` +
		`{"type":"web_search_result_location","url":"https://example.org/shannon",` +
		`"title":"Shannon","encrypted_index":"idx-2","cited_text":"Petoskey"},` +
		`{"type":"web_search_result_location","url":"https://example.net/bio",` +
		`"title":"Biography","encrypted_index":"idx-3","cited_text":"1916"}]}`
)

// Web search design, S3: the search tool follows the tools of the request, only when asked.
func TestGenerateDeclaresWebSearch(t *testing.T) {
	t.Parallel()

	search := map[string]any{"type": "web_search_20250305", "name": "web_search", "max_uses": 3.0}
	accounts := map[string]any{
		"name": "accounts", "description": "lists accounts",
		"input_schema": map[string]any{"type": "object"},
	}
	tools := []llm.Tool{{
		Name: "accounts", Description: "lists accounts",
		Parameters: json.RawMessage(`{"type":"object"}`),
	}}

	tests := []struct {
		name string
		req  llm.Request
		want any
	}{
		{
			"asked, beside tools",
			llm.Request{WebSearch: true, Tools: tools},
			[]any{accounts, search},
		},
		{"asked, alone", llm.Request{WebSearch: true}, []any{search}},
		{"not asked", llm.Request{Tools: tools}, []any{accounts}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var got received
			srv := serve(t, http.StatusOK, nil, `{"content":[],"stop_reason":"end_turn"}`, &got)
			tt.req.Messages = []llm.Message{user("hi")}

			_, err := anthropic.New(srv.URL, "k", srv.Client()).
				Generate(context.Background(), "claude-a", tt.req)
			if err != nil {
				t.Fatalf("Generate: %v", err)
			}

			if !reflect.DeepEqual(got.body["tools"], tt.want) {
				t.Fatalf("tools = %v, want %v", got.body["tools"], tt.want)
			}
		})
	}
}

// S3, S4: the answer names its searches and its sources, and its blocks travel back unchanged.
func TestGenerateReadsAndReplaysASearch(t *testing.T) {
	t.Parallel()

	body := `{"content":[{"type":"text","text":"Searching. "},` + searchUse + `,` + searchResult +
		`,` + citedText + `],"stop_reason":"end_turn","usage":{"input_tokens":5,` +
		`"output_tokens":7,"server_tool_use":{"web_search_requests":1}}}`
	srv := serve(t, http.StatusOK, nil, body, nil)
	p := anthropic.New(srv.URL, "k", srv.Client())

	resp, err := p.Generate(
		context.Background(),
		"claude-a",
		llm.Request{WebSearch: true, Messages: []llm.Message{user("hi")}},
	)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	assertSearch(t, resp)

	if resp.Text() != "Searching. He was born in 1916." || resp.Usage.WebSearches != 1 ||
		resp.FinishReason != llm.FinishStop {
		t.Fatalf("text = %q, usage = %+v, finish = %s", resp.Text(), resp.Usage, resp.FinishReason)
	}

	var got received
	next := serve(t, http.StatusOK, nil, `{"content":[],"stop_reason":"end_turn"}`, &got)

	_, err = anthropic.New(next.URL, "k", next.Client()).Generate(
		context.Background(),
		"claude-a",
		llm.Request{Messages: []llm.Message{user("hi"), resp.Message, user("and then?")}},
	)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	var want []any
	if err := json.Unmarshal(
		[]byte(
			`[{"type":"text","text":"Searching. "},`+searchUse+`,`+searchResult+`,`+citedText+`]`,
		),
		&want,
	); err != nil {
		t.Fatal(err)
	}

	sent := got.body["messages"].([]any)[1].(map[string]any)["content"]
	if !reflect.DeepEqual(sent, want) {
		t.Fatalf("replayed content = %v\nwant %v", sent, want)
	}
}

// S3, S4: a stream accumulates the query of a search and the citations of a text.
func TestStreamAccumulatesASearch(t *testing.T) {
	t.Parallel()

	srv := serve(t, http.StatusOK, nil, sse(
		`{"type":"message_start","message":{"usage":{"input_tokens":5,"output_tokens":1}}}`,
		`{"type":"content_block_start","index":0,"content_block":{"type":"server_tool_use","id":"srv1","name":"web_search"}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"query\":\"claude shannon"}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":" birth date\"}"}}`,
		`{"type":"content_block_start","index":1,"content_block":`+searchResult+`}`,
		`{"type":"content_block_start","index":2,"content_block":{"type":"text","text":"","citations":[]}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"citations_delta","citation":{"type":"web_search_result_location","url":"https://example.org/shannon","title":"Shannon","encrypted_index":"idx-1","cited_text":"April 30, 1916"}}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"citations_delta","citation":{"type":"web_search_result_location","url":"https://example.net/bio","title":"Biography","encrypted_index":"idx-3","cited_text":"1916"}}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"He was born in 1916."}}`,
		`{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7,"server_tool_use":{"web_search_requests":1}}}`,
		`{"type":"message_stop"}`,
	), nil)

	resp, err := anthropic.New(srv.URL, "k", srv.Client()).Stream(
		context.Background(),
		"claude-a",
		llm.Request{WebSearch: true, Messages: []llm.Message{user("hi")}},
		func(string) {},
	)
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	assertSearch(t, resp)

	if resp.Text() != "He was born in 1916." || resp.Usage.WebSearches != 1 {
		t.Fatalf("text = %q, usage = %+v", resp.Text(), resp.Usage)
	}
}

// assertSearch checks the search both Generate and Stream read from the same blocks.
func assertSearch(t *testing.T, resp llm.Response) {
	t.Helper()

	if !slices.Equal(resp.Searches, []string{"claude shannon birth date"}) {
		t.Fatalf("searches = %q", resp.Searches)
	}

	want := []llm.Source{
		{URL: "https://example.org/shannon", Title: "Shannon"},
		{URL: "https://example.net/bio", Title: "Biography"},
	}
	if !slices.Equal(resp.Sources, want) {
		t.Fatalf("sources = %+v", resp.Sources)
	}
}
