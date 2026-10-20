package tool

import (
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// runEcho lets a model call echo once with args and returns the tool result it received.
func runEcho(t *testing.T, args string) llm.ToolResult {
	t.Helper()
	r, _ := newTestRegistry(t)
	s, err := r.Select("echo")
	if err != nil {
		t.Fatal(err)
	}
	tools, handlers := s.LLM()
	call := llm.ToolCall{ID: "c1", Name: "echo", Args: json.RawMessage(args)}
	p := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: llm.Response{
			Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{ToolCall: &call}}},
			FinishReason: llm.FinishToolCalls,
		}},
		llmtest.Step{Model: "m1", Response: llm.Response{
			Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: "done"}}},
			FinishReason: llm.FinishStop,
		}},
	)
	clk := clock.New(time.UTC, func() time.Time { return time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC) })
	router := llm.NewRouter(&clk, slog.New(slog.DiscardHandler), p)
	req := llm.Request{Tools: tools, Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "echo"}}}}}
	_, history, err := llm.RunTools(userCtx(t), router.Client(llm.Target{Provider: "a", Model: "m1"}), req, handlers, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 4 || history[2].Role != llm.RoleTool || len(history[2].Parts) != 1 || history[2].Parts[0].ToolResult == nil {
		t.Fatalf("history = %+v", history)
	}
	return *history[2].Parts[0].ToolResult
}

func TestSetLLM(t *testing.T) {
	r, _ := newTestRegistry(t)
	s, err := r.Select("echo", "optional")
	if err != nil {
		t.Fatal(err)
	}
	tools, handlers := s.LLM()
	if len(tools) != 2 || len(handlers) != 2 || tools[0].Name != "echo" || tools[1].Name != "optional" {
		t.Fatalf("tools = %+v, handlers = %d", tools, len(handlers))
	}
	if tools[0].Description != "Echo the text." {
		t.Errorf("description = %q", tools[0].Description)
	}
	echo, _ := r.Tool("echo")
	assertJSON(t, echo.InputSchema(), string(tools[0].Parameters))

	t.Run("result reaches the model", func(t *testing.T) {
		res := runEcho(t, `{"text":"hi"}`)
		if res.IsError || string(res.Content) != `{"text":"hi"}` {
			t.Errorf("result = %+v", res)
		}
	})
	t.Run("tool error reaches the model", func(t *testing.T) {
		res := runEcho(t, `{}`)
		if !res.IsError {
			t.Fatalf("result = %+v", res)
		}
		var e Error
		if err := json.Unmarshal(res.Content, &e); err != nil || e.Code != "invalid_arguments" {
			t.Errorf("content = %s", res.Content)
		}
	})
}
