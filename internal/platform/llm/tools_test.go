package llm_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

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
	t.Parallel()
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
		{"tool error", "balance", map[string]llm.ToolHandler{"balance": handler("", &llm.ToolError{Content: json.RawMessage(`{"code":"not_found"}`)})}, `{"code":"not_found"}`},
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
	t.Parallel()
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

func twoCalls() llm.Response {
	return calls(llm.ToolCall{ID: "c1", Name: "balance", Args: json.RawMessage(`{}`)})
}

func TestRunForcesAnswer(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance"})},
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c2", Name: "balance"})},
		llmtest.Step{Model: "m1", Response: text("done")},
	)
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	res, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 3, ForceAnswer: true})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	reqs := a.Requests()
	if reqs[0].Request.ToolChoice != llm.ToolChoiceAuto || reqs[1].Request.ToolChoice != llm.ToolChoiceAuto || reqs[2].Request.ToolChoice != llm.ToolChoiceNone {
		t.Fatalf("tool choices = %q %q %q", reqs[0].Request.ToolChoice, reqs[1].Request.ToolChoice, reqs[2].Request.ToolChoice)
	}
	if !res.StepLimit || res.Steps != 3 || res.Response.Text() != "done" {
		t.Fatalf("result = StepLimit %v, Steps %d, Text %q", res.StepLimit, res.Steps, res.Response.Text())
	}
}

func TestRunForcedStepStillCalling(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance"})},
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c2", Name: "balance"})},
	)
	f := newFixture(a)
	n := 0
	handlers := map[string]llm.ToolHandler{"balance": func(context.Context, json.RawMessage) (json.RawMessage, error) {
		n++
		return json.RawMessage(`{}`), nil
	}}
	res, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 2, ForceAnswer: true})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if n != 1 || !res.StepLimit {
		t.Fatalf("handler calls = %d, StepLimit = %v, want 1, true", n, res.StepLimit)
	}
}

func TestRunWithoutForceKeepsLimit(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a", llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance"})})
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	_, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 1})
	if !errors.Is(err, llm.ErrTooManySteps) {
		t.Fatalf("err = %v, want ErrTooManySteps", err)
	}
}

func TestRunAssignsCallIDs(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{Name: "balance", Args: json.RawMessage(`{}`)})},
		llmtest.Step{Model: "m1", Response: text("ok")},
	)
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	res, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 3})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if got := res.History[1].Parts[0].ToolCall.ID; got != "call_1_0" {
		t.Fatalf("call ID = %q, want call_1_0", got)
	}
	if got := res.History[2].Parts[0].ToolResult.CallID; got != "call_1_0" {
		t.Fatalf("result CallID = %q, want call_1_0", got)
	}
}

func TestRunOnToolCall(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: calls(llm.ToolCall{ID: "c1", Name: "balance"}, llm.ToolCall{ID: "c2", Name: "rate"})},
		llmtest.Step{Model: "m1", Response: text("ok")},
	)
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil), "rate": handler(`{}`, nil)}
	var names []string
	opts := llm.LoopOptions{MaxSteps: 3, OnToolCall: func(c llm.ToolCall) { names = append(names, c.Name) }}
	if _, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, opts); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !reflect.DeepEqual(names, []string{"balance", "rate"}) {
		t.Fatalf("names = %v", names)
	}
}

func TestRunPinsAndRestarts(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: twoCalls()},
		llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}},
	)
	b := llmtest.New("b",
		llmtest.Step{Model: "m1", Response: twoCalls()},
		llmtest.Step{Model: "m1", Response: text("from b")},
	)
	f := newFixture(a, b)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	restarts := 0
	opts := llm.LoopOptions{MaxSteps: 5, Pin: true, OnRestart: func() { restarts++ }}
	res, err := llm.Run(context.Background(), f.router.Client(target("a/m1"), target("b/m1")), prompt(), handlers, opts)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !res.Restarted || restarts != 1 || res.Steps != 2 || res.Response.Text() != "from b" {
		t.Fatalf("Restarted %v, restarts %d, Steps %d, Text %q", res.Restarted, restarts, res.Steps, res.Response.Text())
	}
	if got := len(b.Requests()[0].Request.Messages); got != 1 {
		t.Fatalf("first request after restart has %d messages, want 1", got)
	}
	if got := a.Requests()[1].Request.Pin; got != target("a/m1") {
		t.Fatalf("pin = %v, want a/m1", got)
	}
}

func TestRunRestartsOnce(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Response: twoCalls()},
		llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}},
	)
	b := llmtest.New("b",
		llmtest.Step{Model: "m1", Response: twoCalls()},
		llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}},
	)
	f := newFixture(a, b)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	_, err := llm.Run(context.Background(), f.router.Client(target("a/m1"), target("b/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 5, Pin: true})
	if !errors.Is(err, llm.ErrExhausted) {
		t.Fatalf("err = %v, want ErrExhausted", err)
	}
}

func TestRunSumsUsage(t *testing.T) {
	t.Parallel()
	first := twoCalls()
	first.Usage = llm.Usage{InputTokens: 10, OutputTokens: 2}
	last := text("ok")
	last.Usage = llm.Usage{InputTokens: 20, OutputTokens: 3}
	a := llmtest.New("a", llmtest.Step{Model: "m1", Response: first}, llmtest.Step{Model: "m1", Response: last})
	f := newFixture(a)
	handlers := map[string]llm.ToolHandler{"balance": handler(`{}`, nil)}
	res, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{MaxSteps: 3})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if want := (llm.Usage{InputTokens: 30, OutputTokens: 5}); res.Usage != want {
		t.Fatalf("Usage = %+v, want %+v", res.Usage, want)
	}
}
