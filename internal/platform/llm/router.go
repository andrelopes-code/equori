package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
)

const (
	quotaCooldown     = 60 * time.Second
	transientCooldown = 10 * time.Second
)

// Router holds the registered providers and one cooldown table shared by every Client,
// because providers count quota per model, not per use.
type Router struct {
	clk       *clock.Clock
	log       *slog.Logger
	res       Resolver
	providers map[string]Provider

	mu       sync.Mutex
	cooldown map[Target]time.Time
}

// NewRouter serves fixed chains over providers and uses through res, which may be nil.
func NewRouter(clk *clock.Clock, log *slog.Logger, res Resolver, providers ...Provider) *Router {
	r := &Router{clk: clk, log: log, res: res, providers: map[string]Provider{}, cooldown: map[Target]time.Time{}}
	for _, p := range providers {
		r.providers[p.Name()] = p
	}
	return r
}

// Providers returns the registered provider names, sorted.
func (r *Router) Providers() []string {
	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

// Client returns the handle of one use, which tries chain in order.
func (r *Router) Client(chain ...Target) *Client {
	return &Client{router: r, chain: slices.Clone(chain)}
}

// Use returns the handle of u, whose targets are resolved on every call.
func (r *Router) Use(u Use) *Client {
	return &Client{router: r, use: &u}
}

type Client struct {
	router *Router
	chain  []Target
	use    *Use
}

func (c *Client) bindings(ctx context.Context) ([]Binding, error) {
	r := c.router
	if c.use != nil {
		if r.res == nil {
			return nil, nil
		}
		b, err := r.res.Resolve(ctx, *c.use)
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

// Generate sends req to the first available target of the chain and moves to the next one
// on quota exhaustion or transient failure. It never waits for a cooldown to end.
func (c *Client) Generate(ctx context.Context, req Request) (Response, error) {
	r := c.router
	bindings, err := c.bindings(ctx)
	if err != nil {
		return Response{}, err
	}
	if req.Pin != (Target{}) {
		bindings = slices.DeleteFunc(bindings, func(b Binding) bool { return b.Target != req.Pin })
		if len(bindings) == 0 {
			return Response{}, &ExhaustedError{RetryAt: r.clk.Now()}
		}
	}
	for _, b := range bindings {
		t, p := b.Target, b.Provider
		if r.coolingDown(t) {
			continue
		}
		begin := r.clk.Now()
		resp, err := p.Generate(ctx, t.Model, req)
		elapsed := r.clk.Now().Sub(begin)
		if err == nil {
			resp.Target = t
			c.record(ctx, Attempt{Target: t, Outcome: "ok", Usage: resp.Usage})
			r.log.Info("llm call", "provider", t.Provider, "model", t.Model, "outcome", "ok", "duration", elapsed,
				"input_tokens", resp.Usage.InputTokens, "output_tokens", resp.Usage.OutputTokens)
			// A tool call step or a blocked answer carries no JSON text to check.
			checked := resp.FinishReason != FinishToolCalls && resp.FinishReason != FinishBlocked
			if req.Schema != nil && checked && !json.Valid([]byte(resp.Text())) {
				return Response{}, fmt.Errorf("generate with %s: %w", t, ErrMalformedOutput)
			}
			return resp, nil
		}
		if ctx.Err() != nil {
			r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", "canceled", "duration", elapsed)
			// The caller's context is done; the attempt is still recorded.
			c.record(context.WithoutCancel(ctx), Attempt{Target: t, Outcome: "canceled"})
			return Response{}, fmt.Errorf("generate with %s: %w", t, ctx.Err())
		}
		outcome, wait := classify(err)
		if wait == 0 {
			c.record(ctx, Attempt{Target: t, Outcome: outcome})
			r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome, "duration", elapsed)
			return Response{}, fmt.Errorf("generate with %s: %w", t, err)
		}
		until := r.clk.Now().Add(wait)
		r.setCooldown(t, until)
		c.record(ctx, Attempt{Target: t, Outcome: outcome, CooldownUntil: until})
		r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome, "duration", elapsed,
			"cooldown_until", until)
	}
	if len(bindings) == 0 {
		return Response{}, ErrUnavailable
	}
	return Response{}, &ExhaustedError{RetryAt: r.earliestEnd(bindings)}
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

func (r *Router) coolingDown(t Target) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.cooldown[t].After(r.clk.Now())
}

func (r *Router) setCooldown(t Target, until time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if until.After(r.cooldown[t]) {
		r.cooldown[t] = until
	}
}

func (r *Router) earliestEnd(bindings []Binding) time.Time {
	r.mu.Lock()
	defer r.mu.Unlock()
	var earliest time.Time
	for _, b := range bindings {
		if end := r.cooldown[b.Target]; earliest.IsZero() || end.Before(earliest) {
			earliest = end
		}
	}
	return earliest
}
