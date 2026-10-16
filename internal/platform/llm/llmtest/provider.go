// Package llmtest provides a scripted llm.Provider for tests.
package llmtest

import (
	"context"
	"fmt"
	"sync"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// Step is one expected call: the model it must name and what it returns.
type Step struct {
	Model    string
	Response llm.Response
	Err      error
}

// Call is one request the provider received.
type Call struct {
	Model   string
	Request llm.Request
}

// Provider answers calls with its steps in order. A call for another model than the next
// step names, or past the last step, returns an error describing the mismatch.
type Provider struct {
	name string

	mu    sync.Mutex
	steps []Step
	calls []Call
}

func New(name string, steps ...Step) *Provider {
	return &Provider{name: name, steps: steps}
}

func (p *Provider) Name() string { return p.name }

func (p *Provider) Generate(_ context.Context, model string, req llm.Request) (llm.Response, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, Call{Model: model, Request: req})
	if len(p.steps) == 0 {
		return llm.Response{}, fmt.Errorf("llmtest %s: unexpected call for model %s", p.name, model)
	}
	step := p.steps[0]
	if step.Model != model {
		return llm.Response{}, fmt.Errorf("llmtest %s: call for model %s, want %s", p.name, model, step.Model)
	}
	p.steps = p.steps[1:]
	return step.Response, step.Err
}

// Requests returns the calls received so far.
func (p *Provider) Requests() []Call {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]Call(nil), p.calls...)
}
