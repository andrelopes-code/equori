package llm

import (
	"context"
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
	providers map[string]Provider

	mu       sync.Mutex
	cooldown map[Target]time.Time
}

func NewRouter(clk *clock.Clock, log *slog.Logger, providers ...Provider) *Router {
	r := &Router{clk: clk, log: log, providers: map[string]Provider{}, cooldown: map[Target]time.Time{}}
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

type Client struct {
	router *Router
	chain  []Target
}

// Generate sends req to the first available target of the chain and moves to the next one
// on quota exhaustion or transient failure. It never waits for a cooldown to end.
func (c *Client) Generate(ctx context.Context, req Request) (Response, error) {
	r := c.router
	registered := false
	for _, t := range c.chain {
		p, ok := r.providers[t.Provider]
		if !ok {
			continue
		}
		registered = true
		if r.coolingDown(t) {
			continue
		}
		begin := r.clk.Now()
		resp, err := p.Generate(ctx, t.Model, req)
		elapsed := r.clk.Now().Sub(begin)
		if err == nil {
			resp.Target = t
			r.log.Info("llm call", "provider", t.Provider, "model", t.Model, "outcome", "ok", "duration", elapsed,
				"input_tokens", resp.Usage.InputTokens, "output_tokens", resp.Usage.OutputTokens)
			return resp, nil
		}
		if ctx.Err() != nil {
			r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", "canceled", "duration", elapsed)
			return Response{}, fmt.Errorf("generate with %s: %w", t, ctx.Err())
		}
		outcome, wait := classify(err)
		if wait == 0 {
			r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome, "duration", elapsed)
			return Response{}, fmt.Errorf("generate with %s: %w", t, err)
		}
		until := r.clk.Now().Add(wait)
		r.setCooldown(t, until)
		r.log.Warn("llm call", "provider", t.Provider, "model", t.Model, "outcome", outcome, "duration", elapsed,
			"cooldown_until", until)
	}
	if !registered {
		return Response{}, ErrUnavailable
	}
	return Response{}, &ExhaustedError{RetryAt: r.earliestEnd(c.chain)}
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

func (r *Router) earliestEnd(chain []Target) time.Time {
	r.mu.Lock()
	defer r.mu.Unlock()
	var earliest time.Time
	for _, t := range chain {
		if _, ok := r.providers[t.Provider]; !ok {
			continue
		}
		if end := r.cooldown[t]; earliest.IsZero() || end.Before(earliest) {
			earliest = end
		}
	}
	return earliest
}
