package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"
)

type Client struct {
	router *Router
	chain  []Target
	use    *Use
}

// Generate sends req to the first available target of the chain and moves to the next one
// on quota exhaustion or transient failure. It never waits for a cooldown to end.
func (c *Client) Generate(ctx context.Context, req Request) (Response, error) {
	return c.Stream(ctx, req, nil)
}

// Stream is Generate that hands the answer's text to onText as it arrives, when onText is set and
// the target's provider is a Streamer. A failure after the first text ends the call with that
// error: the text already handed out belongs to this target (design 2026-10-26 E3).
func (c *Client) Stream(ctx context.Context, req Request, onText func(string)) (Response, error) {
	r := c.router

	bindings, err := c.bindings(ctx, req.HasFiles())
	if err != nil {
		return Response{}, err
	}

	if req.Pin != (Target{}) {
		bindings = pinnedBindings(bindings, req.Pin)
		if len(bindings) == 0 {
			return Response{}, &ExhaustedError{RetryAt: r.clk.Now()}
		}
	}

	for _, b := range bindings {
		if r.coolingDown(b.Target) {
			continue
		}

		call := c.callTarget(ctx, b, req, onText)
		if call.err == nil {
			return c.acceptResponse(ctx, b.Target, req, call)
		}

		if err := c.failAttempt(ctx, b.Target, call); err != nil {
			return Response{}, err
		}
	}

	if len(bindings) == 0 {
		return Response{}, ErrUnavailable
	}

	return Response{}, &ExhaustedError{
		RetryAt:   r.earliestEnd(bindings),
		Transient: r.allTransient(bindings),
	}
}

// bindings resolves the targets of the client; a request with files keeps those that read
// images (assistant parity design, F6).
func (c *Client) bindings(ctx context.Context, files bool) ([]Binding, error) {
	r := c.router
	if c.use != nil {
		if r.res == nil {
			return nil, nil
		}

		use := *c.use
		if files && !slices.Contains(use.Needs, CapImageInput) {
			use.Needs = append(slices.Clone(use.Needs), CapImageInput)
		}

		b, err := r.res.Resolve(ctx, use)
		if err != nil {
			return nil, fmt.Errorf("resolve %s: %w", c.use.ID, err)
		}

		return b, nil
	}

	var out []Binding
	for _, t := range c.chain {
		if p, ok := r.providers[t.Provider]; ok {
			out = append(out, Binding{Target: t, Provider: p})
		}
	}

	return out, nil
}

// pinnedBindings keeps the bindings of pin.
func pinnedBindings(bindings []Binding, pin Target) []Binding {
	return slices.DeleteFunc(bindings, func(b Binding) bool { return b.Target != pin })
}

// targetCall is the outcome of one provider call: started reports that text reached the caller.
type targetCall struct {
	resp    Response
	err     error
	started bool
	elapsed time.Duration
}

func (c *Client) callTarget(
	ctx context.Context,
	b Binding,
	req Request,
	onText func(string),
) targetCall {
	r := c.router
	t, p := b.Target, b.Provider
	begin := r.clk.Now()

	var call targetCall
	if s, ok := p.(Streamer); ok && onText != nil {
		call.resp, call.err = s.Stream(ctx, t.Model, req, func(text string) {
			call.started = true

			onText(text)
		})
	} else {
		call.resp, call.err = p.Generate(ctx, t.Model, req)
	}

	call.elapsed = r.clk.Now().Sub(begin)

	return call
}

// acceptResponse logs and records a successful call and checks the answer against the schema.
func (c *Client) acceptResponse(
	ctx context.Context,
	t Target,
	req Request,
	call targetCall,
) (Response, error) {
	resp := call.resp
	resp.Target = t
	c.record(ctx, Attempt{Target: t, Outcome: "ok", Usage: resp.Usage})
	c.router.log.Info("llm call", "provider", t.Provider, "model", t.Model, "outcome", "ok",
		"duration", call.elapsed, "input_tokens", resp.Usage.InputTokens,
		"output_tokens", resp.Usage.OutputTokens)
	// A tool call step or a blocked answer carries no JSON text to check.
	checked := resp.FinishReason != FinishToolCalls && resp.FinishReason != FinishBlocked
	if req.Schema != nil && checked && !json.Valid([]byte(resp.Text())) {
		return Response{}, fmt.Errorf("generate with %s: %w", t, ErrMalformedOutput)
	}

	return resp, nil
}

// failAttempt records a failed call. It returns the error that ends Stream, or nil when the
// target cooled down and the next one is tried.
func (c *Client) failAttempt(ctx context.Context, t Target, call targetCall) error {
	r := c.router
	err, elapsed := call.err, call.elapsed

	if ctx.Err() != nil {
		r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", "canceled",
			"duration", elapsed)
		// The caller's context is done; the attempt is still recorded.
		c.record(context.WithoutCancel(ctx), Attempt{Target: t, Outcome: "canceled"})

		return fmt.Errorf("generate with %s: %w", t, ctx.Err())
	}

	outcome, wait := classify(err)
	if wait == 0 || call.started {
		c.record(ctx, Attempt{Target: t, Outcome: outcome})
		r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome,
			"duration", elapsed)

		return fmt.Errorf("generate with %s: %w", t, err)
	}

	until := r.clk.Now().Add(wait)
	r.setCooldown(t, until, outcome == "quota")
	c.record(ctx, Attempt{Target: t, Outcome: outcome, CooldownUntil: until})
	r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome,
		"duration", elapsed, "cooldown_until", until)

	return nil
}

// record hands a use client's attempt to the resolver when it is also a Recorder.
func (c *Client) record(ctx context.Context, a Attempt) {
	if c.use == nil {
		return
	}

	if rec, ok := c.router.res.(Recorder); ok {
		a.Use = c.use.ID
		rec.Record(ctx, a)
	}
}

// classify returns the log outcome of err and the cooldown it earns; 0 means the error goes
// back to the caller.
func classify(err error) (string, time.Duration) {
	var quota *QuotaError
	switch {
	case errors.As(err, &quota):
		if quota.RetryAfter > 0 {
			return "quota", quota.RetryAfter
		}

		return "quota", quotaCooldown
	case errors.Is(err, ErrQuota):
		return "quota", quotaCooldown
	case errors.Is(err, ErrTransient):
		return "transient", transientCooldown
	case errors.Is(err, ErrInvalidRequest):
		return "invalid", 0
	case errors.Is(err, ErrUnauthorized):
		return "unauthorized", 0
	default:
		return "error", 0
	}
}
