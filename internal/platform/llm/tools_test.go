package llm_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
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

// Design 2026-10-26 E3: Run streams the text of every model call when OnText is set.
func TestRunStreams(t *testing.T) {
	t.Parallel()
	first := llmtest.Step{Model: "m1", Chunks: []string{"Vou ", "ver."}, Response: calls(llm.ToolCall{Name: "get_x", Args: json.RawMessage(`{}`)})}
	a := llmtest.New("a", first, llmtest.Step{Model: "m1", Chunks: []string{"R$ ", "10"}, Response: text("R$ 10")})
	f := newFixture(a)
	var got []string
	_, err := llm.Run(context.Background(), f.router.Client(target("a/m1")), prompt(),
		map[string]llm.ToolHandler{"get_x": handler(`{}`, nil)},
		llm.LoopOptions{MaxSteps: 3, OnText: func(s string) { got = append(got, s) }})
	if want := []string{"Vou ", "ver.", "R$ ", "10"}; err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("chunks = %v, err = %v, want %v", got, err, want)
	}
}

// Design 2026-10-26 E13: the read calls of one response run concurrently, at most 4 at a time;
// the other calls run after them in response order; results keep response order.
func TestRunConcurrentReads(t *testing.T) {
	t.Parallel()
	run := func(t *testing.T, names []string, handlers map[string]llm.ToolHandler, onCall func(llm.ToolCall)) []llm.ToolResult {
		t.Helper()
		var cs []llm.ToolCall
		for _, n := range names {
			cs = append(cs, llm.ToolCall{ID: n, Name: n, Args: json.RawMessage(`{}`)})
		}
		a := llmtest.New("a", llmtest.Step{Model: "m1", Response: calls(cs...)}, llmtest.Step{Model: "m1", Response: text("ok")})
		f := newFixture(a)
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()
		res, err := llm.Run(ctx, f.router.Client(target("a/m1")), prompt(), handlers, llm.LoopOptions{
			MaxSteps: 3, OnToolCall: onCall,
			Concurrent: func(name string) bool { return strings.HasPrefix(name, "r") },
		})
		if err != nil {
			t.Fatalf("Run: %v", err)
		}
		return toolMessage(t, res.History, 2)
	}
	names := func(rs []llm.ToolResult) []string {
		var out []string
		for _, r := range rs {
			out = append(out, r.Name)
		}
		return out
	}
	// waitFor returns a handler that waits until gate closes or the context ends.
	waitFor := func(gate <-chan struct{}, before func()) llm.ToolHandler {
		return func(ctx context.Context, _ json.RawMessage) (json.RawMessage, error) {
			before()
			select {
			case <-gate:
				return json.RawMessage(`{}`), nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
	}
	t.Run("reads run together", func(t *testing.T) {
		t.Parallel()
		all := make(chan struct{})
		var started atomic.Int32
		h := waitFor(all, func() {
			if started.Add(1) == 3 {
				close(all)
			}
		})
		got := run(t, []string{"r1", "r2", "r3"}, map[string]llm.ToolHandler{"r1": h, "r2": h, "r3": h}, nil)
		if !slices.Equal(names(got), []string{"r1", "r2", "r3"}) {
			t.Fatalf("results = %v", names(got))
		}
	})
	t.Run("at most four at a time", func(t *testing.T) {
		t.Parallel()
		four := make(chan struct{})
		var mu sync.Mutex
		started, inflight, peak := 0, 0, 0
		inner := waitFor(four, func() {
			mu.Lock()
			defer mu.Unlock()
			started++
			inflight++
			peak = max(peak, inflight)
			if started == 4 {
				close(four)
			}
		})
		h := func(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
			defer func() { mu.Lock(); inflight--; mu.Unlock() }()
			return inner(ctx, args)
		}
		handlers := map[string]llm.ToolHandler{}
		ns := []string{"r1", "r2", "r3", "r4", "r5", "r6"}
		for _, n := range ns {
			handlers[n] = h
		}
		got := run(t, ns, handlers, nil)
		if peak != 4 || !slices.Equal(names(got), ns) {
			t.Fatalf("peak = %d, results = %v", peak, names(got))
		}
	})
	t.Run("writes after reads, in response order", func(t *testing.T) {
		t.Parallel()
		var mu sync.Mutex
		var order, seen []string
		rec := func(n string) llm.ToolHandler {
			return func(context.Context, json.RawMessage) (json.RawMessage, error) {
				mu.Lock()
				defer mu.Unlock()
				order = append(order, n)
				return json.RawMessage(`{}`), nil
			}
		}
		ns := []string{"w1", "r1", "w2", "r2"}
		got := run(t, ns, map[string]llm.ToolHandler{"w1": rec("w1"), "r1": rec("r1"), "w2": rec("w2"), "r2": rec("r2")},
			func(c llm.ToolCall) { seen = append(seen, c.Name) })
		pos := func(n string) int { return slices.Index(order, n) }
		if pos("r1") > pos("w1") || pos("r2") > pos("w1") || pos("w1") > pos("w2") || !slices.Equal(names(got), ns) || !slices.Equal(seen, ns) {
			t.Fatalf("start order = %v, results = %v, OnToolCall = %v", order, names(got), seen)
		}
	})
	// Review Focus 5 of phase 2.
	t.Run("a failing read keeps its place", func(t *testing.T) {
		t.Parallel()
		got := run(t, []string{"r1", "r2"}, map[string]llm.ToolHandler{"r1": handler("", errors.New("boom")), "r2": handler(`{"v":2}`, nil)}, nil)
		if !slices.Equal(names(got), []string{"r1", "r2"}) || !got[0].IsError || got[1].IsError {
			t.Fatalf("results = %+v", got)
		}
	})
}
