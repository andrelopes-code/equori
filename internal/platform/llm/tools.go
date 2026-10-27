package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sync"
)

// maxConcurrent bounds the calls of one response that run at the same time (design 2026-10-26 E13).
const maxConcurrent = 4

// ToolHandler executes one tool call; args follow the tool's Parameters schema.
type ToolHandler func(ctx context.Context, args json.RawMessage) (json.RawMessage, error)

// ToolError is a handler failure whose JSON content reaches the model unchanged.
type ToolError struct{ Content json.RawMessage }

func (e *ToolError) Error() string { return string(e.Content) }

// RunTools calls the model until it answers without a tool call, running each requested
// tool with its handler. It returns the final response and the whole conversation, which
// keeps every signature for a later turn. A handler error goes back to the model as an
// error result; only a context error stops the loop.
func RunTools(ctx context.Context, client *Client, req Request, handlers map[string]ToolHandler, maxSteps int) (Response, []Message, error) {
	res, err := Run(ctx, client, req, handlers, LoopOptions{MaxSteps: maxSteps})
	return res.Response, res.History, err
}

// LoopOptions tunes Run. MaxSteps bounds the model calls of one attempt. ForceAnswer makes the
// last allowed call a ToolChoiceNone call whose response is never executed. Pin keeps every
// call after the first on the target that answered the first. OnToolCall runs before each
// tool; OnRestart runs when a pinned call finds its target exhausted. OnText, when set, receives
// the text of every model call as it arrives. Concurrent names the tools whose calls of one response
// run together, before the other calls.
type LoopOptions struct {
	MaxSteps    int
	ForceAnswer bool
	Pin         bool
	OnToolCall  func(ToolCall)
	OnRestart   func()
	OnText      func(string)
	Concurrent  func(name string) bool
}

// Result is the outcome of Run. Steps counts the model calls of the final attempt, Usage
// sums every call, and StepLimit reports an answer forced by ForceAnswer.
type Result struct {
	Response  Response
	History   []Message
	Steps     int
	Usage     Usage
	Restarted bool
	StepLimit bool
}

// Run is RunTools with step-limit forcing, target pinning and one restart. With Pin, a pinned
// call that finds its target exhausted restarts the whole turn once, from req.Messages, on the
// chain again.
func Run(ctx context.Context, client *Client, req Request, handlers map[string]ToolHandler, opts LoopOptions) (Result, error) {
	var res Result
	start := slices.Clone(req.Messages)
	history := slices.Clone(start)
	var pin Target
	step := 0
	for step < opts.MaxSteps {
		step++
		req.Messages = history
		req.Pin = pin
		req.ToolChoice = ToolChoiceAuto
		forced := opts.ForceAnswer && step == opts.MaxSteps
		if forced {
			req.ToolChoice = ToolChoiceNone
		}
		resp, err := client.Stream(ctx, req, opts.OnText)
		if err != nil {
			if pin != (Target{}) && !res.Restarted && errors.Is(err, ErrExhausted) {
				if opts.OnRestart != nil {
					opts.OnRestart()
				}
				history, pin, step, res.Restarted = slices.Clone(start), Target{}, 0, true
				continue
			}
			res.History = history
			return res, err
		}
		res.Usage.InputTokens += resp.Usage.InputTokens
		res.Usage.OutputTokens += resp.Usage.OutputTokens
		if opts.Pin && pin == (Target{}) {
			pin = resp.Target
		}
		for i, p := range resp.Message.Parts {
			if p.ToolCall != nil && p.ToolCall.ID == "" {
				p.ToolCall.ID = fmt.Sprintf("call_%d_%d", step, i)
			}
		}
		history = append(history, resp.Message)
		res.Response, res.History, res.Steps = resp, history, step
		if forced {
			res.StepLimit = true
			return res, nil
		}
		var toolCalls []ToolCall
		for _, p := range resp.Message.Parts {
			if p.ToolCall != nil {
				toolCalls = append(toolCalls, *p.ToolCall)
			}
		}
		results, err := runTools(ctx, handlers, toolCalls, opts)
		if err != nil {
			res.Response = Response{}
			return res, err
		}
		if len(results) == 0 {
			return res, nil
		}
		history = append(history, Message{Role: RoleTool, Parts: results})
	}
	res.Response, res.History = Response{}, history
	return res, ErrTooManySteps
}

// runTools runs the calls of one response: the concurrent ones together, at most maxConcurrent at a
// time, then the others one by one in response order. Results keep response order.
func runTools(ctx context.Context, handlers map[string]ToolHandler, calls []ToolCall, opts LoopOptions) ([]Part, error) {
	if opts.OnToolCall != nil {
		for _, c := range calls {
			opts.OnToolCall(c)
		}
	}
	results := make([]Part, len(calls))
	errs := make([]error, len(calls))
	concurrent := func(c ToolCall) bool { return opts.Concurrent != nil && opts.Concurrent(c.Name) }
	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup
	for i, c := range calls {
		if !concurrent(c) {
			continue
		}
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()
			r, err := runTool(ctx, handlers, c)
			results[i], errs[i] = Part{ToolResult: &r}, err
		})
	}
	wg.Wait()
	if err := errors.Join(errs...); err != nil {
		return nil, err
	}
	for i, c := range calls {
		if concurrent(c) {
			continue
		}
		r, err := runTool(ctx, handlers, c)
		if err != nil {
			return nil, err
		}
		results[i] = Part{ToolResult: &r}
	}
	return results, nil
}

func runTool(ctx context.Context, handlers map[string]ToolHandler, call ToolCall) (ToolResult, error) {
	result := ToolResult{CallID: call.ID, Name: call.Name}
	h, ok := handlers[call.Name]
	if !ok {
		result.Content, result.IsError = errorContent("unknown tool "+call.Name), true
		return result, nil
	}
	out, err := h(ctx, call.Args)
	if err != nil {
		if ctx.Err() != nil || isContextError(err) {
			return ToolResult{}, fmt.Errorf("run tool %s: %w", call.Name, err)
		}
		if te, ok := errors.AsType[*ToolError](err); ok {
			result.Content, result.IsError = te.Content, true
			return result, nil
		}
		result.Content, result.IsError = errorContent(err.Error()), true
		return result, nil
	}
	result.Content = out
	return result, nil
}

func isContextError(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

func errorContent(msg string) json.RawMessage {
	b, _ := json.Marshal(map[string]string{"error": msg})
	return b
}
