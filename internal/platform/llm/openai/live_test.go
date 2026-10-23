//go:build live

// The live test calls a real chat completions API, such as Groq or a local Ollama:
//
//	EQUORI_OPENAI_LIVE_URL=https://api.groq.com/openai/v1 EQUORI_OPENAI_LIVE_KEY=... \
//	EQUORI_OPENAI_LIVE_MODEL=openai/gpt-oss-120b go test -tags live -run TestLive ./internal/platform/llm/openai/
package openai_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/openai"
)

func TestLive(t *testing.T) {
	t.Parallel()
	baseURL, model := os.Getenv("EQUORI_OPENAI_LIVE_URL"), os.Getenv("EQUORI_OPENAI_LIVE_MODEL")
	if baseURL == "" || model == "" {
		t.Fatal("EQUORI_OPENAI_LIVE_URL and EQUORI_OPENAI_LIVE_MODEL must be set")
	}
	clk := clock.New(time.UTC, time.Now)
	p := openai.New(baseURL, os.Getenv("EQUORI_OPENAI_LIVE_KEY"), &http.Client{Timeout: 2 * time.Minute})
	client := llm.NewRouter(&clk, slog.New(slog.NewTextHandler(os.Stderr, nil)), nil, p).Client(llm.Target{Provider: "openai", Model: model})
	ctx := context.Background()

	t.Run("text", func(t *testing.T) {
		resp, err := client.Generate(ctx, llm.Request{Messages: []llm.Message{user("Reply with the word pong.")}})
		if err != nil {
			t.Fatal(err)
		}
		if resp.Text() == "" || resp.FinishReason != llm.FinishStop {
			t.Fatalf("response = %+v", resp)
		}
	})

	t.Run("json schema", func(t *testing.T) {
		resp, err := client.Generate(ctx, llm.Request{
			Messages: []llm.Message{user("Give the capital of Brazil.")},
			Schema:   json.RawMessage(`{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}`),
		})
		if err != nil {
			t.Fatal(err)
		}
		var out struct{ City string }
		if err := json.Unmarshal([]byte(resp.Text()), &out); err != nil || out.City == "" {
			t.Fatalf("answer %q: %v", resp.Text(), err)
		}
	})

	t.Run("tool round trip", func(t *testing.T) {
		calls := 0
		handlers := map[string]llm.ToolHandler{"today": func(context.Context, json.RawMessage) (json.RawMessage, error) {
			calls++
			return json.RawMessage(`{"date":"2026-10-16"}`), nil
		}}
		req := llm.Request{
			Messages: []llm.Message{user("What is today's date? Use the today tool.")},
			Tools:    []llm.Tool{{Name: "today", Description: "Returns today's date.", Parameters: json.RawMessage(`{"type":"object","properties":{}}`)}},
		}
		resp, _, err := llm.RunTools(ctx, client, req, handlers, 4)
		if err != nil {
			t.Fatal(err)
		}
		if calls != 1 || resp.Text() == "" {
			t.Fatalf("tool calls = %d, final answer %q", calls, resp.Text())
		}
	})
}
