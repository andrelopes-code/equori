package llm

import (
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
	cooldown map[Target]cooldown
}

// cooldown is the end of a target's pause and whether a quota failure started it.
type cooldown struct {
	until time.Time
	quota bool
}

// NewRouter serves fixed chains over providers and uses through res, which may be nil.
func NewRouter(clk *clock.Clock, log *slog.Logger, res Resolver, providers ...Provider) *Router {
	r := &Router{
		clk:       clk,
		log:       log,
		res:       res,
		providers: map[string]Provider{},
		cooldown:  map[Target]cooldown{},
	}
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

func (r *Router) coolingDown(t Target) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.cooldown[t].until.After(r.clk.Now())
}

// setCooldown extends t's cooldown to until; a quota cooldown still running stays a quota cooldown.
func (r *Router) setCooldown(t Target, until time.Time, quota bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	old := r.cooldown[t]
	if until.After(old.until) {
		r.cooldown[t] = cooldown{
			until: until,
			quota: quota || old.quota && old.until.After(r.clk.Now()),
		}
	}
}

// allTransient reports whether no running cooldown of bindings comes from a quota failure.
func (r *Router) allTransient(bindings []Binding) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.clk.Now()
	for _, b := range bindings {
		if c := r.cooldown[b.Target]; c.quota && c.until.After(now) {
			return false
		}
	}

	return true
}

func (r *Router) earliestEnd(bindings []Binding) time.Time {
	r.mu.Lock()
	defer r.mu.Unlock()

	var earliest time.Time
	for _, b := range bindings {
		if end := r.cooldown[b.Target].until; earliest.IsZero() || end.Before(earliest) {
			earliest = end
		}
	}

	return earliest
}
