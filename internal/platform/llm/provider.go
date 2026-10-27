package llm

import "context"

// Provider is one language model service. Generate classifies every failure as a
// *QuotaError, ErrTransient, ErrInvalidRequest or ErrUnauthorized, or returns the
// caller's context error.
type Provider interface {
	Name() string
	Generate(ctx context.Context, model string, req Request) (Response, error)
}

// Streamer is a Provider that also hands out the answer's text as it arrives. Stream returns the
// same Response as Generate and classifies failures the same way.
type Streamer interface {
	Stream(ctx context.Context, model string, req Request, onText func(string)) (Response, error)
}
