package llm

import "context"

// Provider is one language model service. Generate classifies every failure as a
// *QuotaError, ErrTransient, ErrInvalidRequest or ErrUnauthorized, or returns the
// caller's context error.
type Provider interface {
	Name() string
	Generate(ctx context.Context, model string, req Request) (Response, error)
}
