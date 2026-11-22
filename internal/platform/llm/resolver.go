package llm

import (
	"context"
	"time"
)

// Binding is a resolved target with the provider that serves it.
type Binding struct {
	Target   Target
	Provider Provider
	// WebSearch reports that the owner let this target search the web (web search design, S2).
	WebSearch bool
}

// Resolver returns the ordered targets of a use for the request's context.
type Resolver interface {
	Resolve(ctx context.Context, use Use) ([]Binding, error)
}

// Attempt is one provider call of a use client (ADR 019 U1).
type Attempt struct {
	Use     string
	Target  Target
	Outcome string
	Usage   Usage
	// CooldownUntil is set when the attempt cooled its target down.
	CooldownUntil time.Time
}

// Recorder receives the attempts of use clients; a Resolver that implements it is used.
// Record must not block on anything slower than a local database write.
type Recorder interface {
	Record(ctx context.Context, a Attempt)
}
