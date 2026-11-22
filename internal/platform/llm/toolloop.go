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
func RunTools(
	ctx context.Context,
	client *Client,
	req Request,
	handlers map[string]ToolHandler,
	maxSteps int,
) (Response, []Message, error) {
	res, err := Run(ctx, client, req, handlers, LoopOptions{MaxSteps: maxSteps})
	return res.Response, res.History, err
}

// LoopOptions tunes Run. MaxSteps bounds the model calls of one attempt. ForceAnswer makes the
// last allowed call a ToolChoiceNone call whose response is never executed. Pin keeps every
// call after the first on the target that answered the first. OnToolCall runs before each
// tool; OnRestart runs when a pinned call finds its target exhausted. OnText, when set, receives
// the text of every model call as it arrives. Concurrent names the tools whose calls of one response
// run together, before the other calls. OnSearch receives the query of each search the provider
// ran in a model call.
type LoopOptions struct {
	MaxSteps    int
	ForceAnswer bool
	Pin         bool
	OnToolCall  func(ToolCall)
	OnSearch    func(query string)
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
func Run(
	ctx context.Context,
	client *Client,
	req Request,
	handlers map[string]ToolHandler,
	opts LoopOptions,
) (Result, error) {
	start := slices.Clone(req.Messages)
	st := loopState{history: slices.Clone(start)}

	for st.step < opts.MaxSteps {
		st.step++
		req.Messages = st.history
		req.Pin = st.pin
		req.ToolChoice = ToolChoiceAuto

		forced := opts.ForceAnswer && st.step == opts.MaxSteps
		if forced {
			req.ToolChoice = ToolChoiceNone
		}

		resp, err := client.Stream(ctx, req, opts.OnText)
		if err != nil {
			if st.restartPinned(err, start, opts) {
				continue
			}

			st.res.History = st.history

			return st.res, err
		}

		st.accept(resp, opts)

		if forced {
			st.res.StepLimit = true
			return st.res, nil
		}

		results, err := runTools(ctx, handlers, collectToolCalls(resp.Message), opts)
		if err != nil {
			st.res.Response = Response{}
			return st.res, err
		}

		if len(results) == 0 && resp.FinishReason == FinishPaused {
			st.pause(resp)
			continue
		}

		if len(results) == 0 {
			return st.res, nil
		}

		st.history = append(st.history, Message{Role: RoleTool, Parts: results})
	}

	st.res.Response, st.res.History = Response{}, st.history

	return st.res, ErrTooManySteps
}

// loopState is the state of one Run: the result so far, the conversation, the pinned target
// and the model calls of the current attempt.
type loopState struct {
	res     Result
	history []Message
	pin     Target
	step    int
	// paused holds the responses of a turn the provider paused: the next response continues
	// them, so the answer is their text and sources followed by its own (S5).
	paused []Response
}

// restartPinned restarts the turn from start when a pinned call found its target exhausted
// and no restart happened yet; it reports whether it did.
func (st *loopState) restartPinned(err error, start []Message, opts LoopOptions) bool {
	if st.pin == (Target{}) || st.res.Restarted || !errors.Is(err, ErrExhausted) {
		return false
	}

	if opts.OnRestart != nil {
		opts.OnRestart()
	}

	st.history, st.pin, st.step, st.res.Restarted = slices.Clone(start), Target{}, 0, true

	return true
}

// accept adds the usage of resp, pins its target, names the calls without an ID and appends the
// message to the conversation.
func (st *loopState) accept(resp Response, opts LoopOptions) {
	st.res.Usage.InputTokens += resp.Usage.InputTokens
	st.res.Usage.OutputTokens += resp.Usage.OutputTokens

	st.res.Usage.WebSearches += resp.Usage.WebSearches
	if opts.Pin && st.pin == (Target{}) {
		st.pin = resp.Target
	}

	if opts.OnSearch != nil {
		for _, q := range resp.Searches {
			opts.OnSearch(q)
		}
	}

	assignCallIDs(st.step, resp.Message.Parts)

	st.history = append(st.history, resp.Message)

	st.res.Response, st.res.History, st.res.Steps = st.resumed(resp), st.history, st.step
}

// pause keeps a paused response for the answer the next call completes.
func (st *loopState) pause(resp Response) {
	st.paused = append(st.paused, resp)
}

// resumed is resp after the responses it continues: their parts and sources first. The
// conversation keeps each message as it arrived.
func (st *loopState) resumed(resp Response) Response {
	if len(st.paused) == 0 || len(collectToolCalls(resp.Message)) > 0 {
		return resp
	}

	out := resp
	out.Message.Parts, out.Sources = nil, nil

	for _, r := range append(slices.Clone(st.paused), resp) {
		out.Message.Parts = append(out.Message.Parts, r.Message.Parts...)

		for _, s := range r.Sources {
			if !slices.Contains(out.Sources, s) {
				out.Sources = append(out.Sources, s)
			}
		}
	}

	return out
}

func assignCallIDs(step int, parts []Part) {
	for i, p := range parts {
		if p.ToolCall != nil && p.ToolCall.ID == "" {
			p.ToolCall.ID = fmt.Sprintf("call_%d_%d", step, i)
		}
	}
}

func collectToolCalls(msg Message) []ToolCall {
	var calls []ToolCall
	for _, p := range msg.Parts {
		if p.ToolCall != nil {
			calls = append(calls, *p.ToolCall)
		}
	}

	return calls
}

// runTools runs the calls of one response: the concurrent ones together, at most maxConcurrent at a
// time, then the others one by one in response order. Results keep response order.
func runTools(
	ctx context.Context,
	handlers map[string]ToolHandler,
	calls []ToolCall,
	opts LoopOptions,
) ([]Part, error) {
	if opts.OnToolCall != nil {
		for _, c := range calls {
			opts.OnToolCall(c)
		}
	}

	results := make([]Part, len(calls))
	errs := make([]error, len(calls))

	runConcurrent(ctx, handlers, calls, results, errs, opts)

	if err := errors.Join(errs...); err != nil {
		return nil, err
	}

	if err := runSequential(ctx, handlers, calls, results, opts); err != nil {
		return nil, err
	}

	return results, nil
}

func isConcurrent(opts LoopOptions, c ToolCall) bool {
	return opts.Concurrent != nil && opts.Concurrent(c.Name)
}

// runConcurrent runs the concurrent calls together and stores each result and error at the
// index of its call.
func runConcurrent(
	ctx context.Context,
	handlers map[string]ToolHandler,
	calls []ToolCall,
	results []Part,
	errs []error,
	opts LoopOptions,
) {
	sem := make(chan struct{}, maxConcurrent)

	var wg sync.WaitGroup
	for i, c := range calls {
		if !isConcurrent(opts, c) {
			continue
		}

		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()
			// A panic here has no request goroutine above it to recover it.
			defer func() {
				if p := recover(); p != nil {
					errs[i] = fmt.Errorf("run tool %s: panic: %v", c.Name, p)
				}
			}()

			r, err := runTool(ctx, handlers, c)
			results[i], errs[i] = Part{ToolResult: &r}, err
		})
	}

	wg.Wait()
}

// runSequential runs the other calls one by one in response order.
func runSequential(
	ctx context.Context,
	handlers map[string]ToolHandler,
	calls []ToolCall,
	results []Part,
	opts LoopOptions,
) error {
	for i, c := range calls {
		if isConcurrent(opts, c) {
			continue
		}

		r, err := runTool(ctx, handlers, c)
		if err != nil {
			return err
		}

		results[i] = Part{ToolResult: &r}
	}

	return nil
}

func runTool(
	ctx context.Context,
	handlers map[string]ToolHandler,
	call ToolCall,
) (ToolResult, error) {
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
