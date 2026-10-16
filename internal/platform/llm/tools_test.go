package llm_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

func calls(cs ...llm.ToolCall) llm.Response {
	var parts []llm.Part
	for i := range cs {
		parts = append(parts, llm.Part{ToolCall: &cs[i]})
	}
	return llm.Response{Message: llm.Message{Role: llm.RoleModel, Parts: parts}, FinishReason: llm.FinishToolCalls}
}

func handler(out string, err error) llm.ToolHandler {
	return func(context.Context, json.RawMessage) (json.RawMessage, error) {
		if err != nil {
			return nil, err
		}
		return json.RawMessage(out), nil
	}
}

// toolMessage returns the tool results of history[i], failing when it is not a tool message.
func toolMessage(t *testing.T, history []llm.Message, i int) []llm.ToolResult {
	t.Helper()
	if history[i].Role != llm.RoleTool {
		t.Fatalf("history[%d].Role = %s, want tool", i, history[i].Role)
	}
	var results []llm.ToolResult
	for _, p := range history[i].Parts {
		if p.ToolResult == nil {
			t.Fatalf("history[%d] has a part without ToolResult", i)
		}
		results = append(results, *p.ToolResult)
	}
	return results
}

func TestRunTools(t *testing.T) {
	t.Run("final answer after one tool", func(t *testing.T) {
		call := llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{"account":"x"}`)}
		first := calls(call)
		first.Message.Parts[0].Signature = &llm.Signature{Provider: "a", Data: []byte{1}}
		a := llmtest.New("a",
			llmtest.Step{Model: "m1", Response: first},
			llmtest.Step{Model: "m1", Response: text("R$ 10")},
		)
		f := newFixture(a)
		handlers := map[string]llm.ToolHandler{"balance": handler(`{"amount":"10.00"}`, nil)}
		resp, history, err := llm.RunTools(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, 5)
		if err != nil {
			t.Fatalf("RunTools: %v", err)
		}
		if resp.Text() != "R$ 10" {
			t.Fatalf("Text() = %q, want %q", resp.Text(), "R$ 10")
		}
		want := []llm.Message{
			prompt().Messages[0],
			first.Message,
			{Role: llm.RoleTool, Parts: []llm.Part{{ToolResult: &llm.ToolResult{
				CallID: "c1", Name: "balance", Content: json.RawMessage(`{"amount":"10.00"}`),
			}}}},
			text("R$ 10").Message,
		}
		if !reflect.DeepEqual(history, want) {
			t.Fatalf("history = %+v, want %+v", history, want)
		}
		reqs := a.Requests()
		if len(reqs) != 2 || !reflect.DeepEqual(reqs[1].Request.Messages, want[:3]) {
			t.Fatalf("second request messages = %+v, want %+v", reqs[1].Request.Messages, want[:3])
		}
	})

	failures := []struct {
		name     string
		call     string
		handlers map[string]llm.ToolHandler
		want     string
	}{
		{"handler error", "balance", map[string]llm.ToolHandler{"balance": handler("", errors.New("account not found"))}, `{"error":"account not found"}`},
		{"unknown tool", "missing", map[string]llm.ToolHandler{}, `{"error":"unknown tool missing"}`},
	}
	for _, tt := range failures {
		t.Run(tt.name, func(t *testing.T) {
			a := llmtest.New("a",
				llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: tt.call, Args: json.RawMessage(`{}`)})},
				llmtest.Step{Model: "m1", Response: text("done")},
			)
			f := newFixture(a)
			_, history, err := llm.RunTools(context.Background(), f.router.Client(target("a/m1")), prompt(), tt.handlers, 5)
			if err != nil {
				t.Fatalf("RunTools: %v", err)
			}
			results := toolMessage(t, history, 2)
			if len(results) != 1 || !results[0].IsError || string(results[0].Content) != tt.want {
				t.Fatalf("results = %+v, want one error result %s", results, tt.want)
			}
		})
	}

	t.Run("too many steps", func(t *testing.T) {
		var steps []llmtest.Step
		for range 4 {
			steps = append(steps, llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{}`)})})
		}
		a := llmtest.New("a", steps...)
		f := newFixture(a)
		handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
		_, _, err := llm.RunTools(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, 3)
		if !errors.Is(err, llm.ErrTooManySteps) {
			t.Fatalf("err = %v, want ErrTooManySteps", err)
		}
		if got := len(a.Requests()); got != 3 {
			t.Fatalf("calls = %d, want 3", got)
		}
	})

	t.Run("handler context error", func(t *testing.T) {
		a := llmtest.New("a",
			llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{}`)})},
			llmtest.Step{Model: "m1", Response: text("done")},
		)
		f := newFixture(a)
		handlers := map[string]llm.ToolHandler{"balance": handler("", context.Canceled)}
		_, _, err := llm.RunTools(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, 5)
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err = %v, want context.Canceled", err)
		}
		if got := len(a.Requests()); got != 1 {
			t.Fatalf("calls = %d, want 1", got)
		}
	})
}

func TestRunToolsParallelCalls(t *testing.T) {
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: calls(
			llm.ToolCall{ID: "c1", Name: "a", Args: json.RawMessage(`{}`)},
			llm.ToolCall{ID: "c2", Name: "b", Args: json.RawMessage(`{}`)},
		)},
		llmtest.Step{Model: "m1", Response: text("done")},
	)
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"a": handler(`{"v":"a"}`, nil), "b": handler(`{"v":"b"}`, nil)}
	_, history, err := llm.RunTools(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, 5)
	if err != nil {
		t.Fatalf("RunTools: %v", err)
	}
	if len(history) != 4 {
		t.Fatalf("history has %d messages, want 4", len(history))
	}
	want := []llm.ToolResult{
		{CallID: "c1", Name: "a", Content: json.RawMessage(`{"v":"a"}`)},
		{CallID: "c2", Name: "b", Content: json.RawMessage(`{"v":"b"}`)},
	}
	if got := toolMessage(t, history, 2); !reflect.DeepEqual(got, want) {
		t.Fatalf("results = %+v, want %+v", got, want)
	}
}
