package llm

import (
	"context"
	"time"
)

// Capability is a feature a use needs from a model (ADR 019).
type Capability string

const (
	CapTools            Capability = "tools"
	CapStructuredOutput Capability = "structured_output"
	CapImageInput       Capability = "image_input"
)

func Capabilities() []Capability {
	return []Capability{CapTools, CapStructuredOutput, CapImageInput}
}

// DefaultTarget names a model of a provider preset; it applies to every provider of that preset.
type DefaultTarget struct {
	Preset string
	Model  string
}

// Use is one purpose a module calls a model for, declared in code by that module.
type Use struct {
	ID                 string
	Needs              []Capability
	SendsFinancialData bool
	Default            []DefaultTarget
}

// Binding is a resolved target with the provider that serves it.
type Binding struct {
	Target   Target
	Provider Provider
}

// Resolver returns the ordered targets of a use for the request's context.
type Resolver interface {
	Resolve(ctx context.Context, use Use) ([]Binding, error)
}

// ModelLister is a provider that lists the models its API serves.
type ModelLister interface {
	Models(ctx context.Context) ([]string, error)
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
