package llm

import (
	"errors"
	"fmt"
	"time"
)

var (
	ErrQuota           = errors.New("quota exhausted")
	ErrTransient       = errors.New("transient provider failure")
	ErrInvalidRequest  = errors.New("invalid request")
	ErrUnauthorized    = errors.New("provider rejected the credentials")
	ErrUnavailable     = errors.New("no provider of the chain is configured")
	ErrExhausted       = errors.New("every target of the chain is cooling down")
	ErrMalformedOutput = errors.New("answer is not valid JSON")
	ErrTooManySteps    = errors.New("tool loop exceeded its step limit")
)

// QuotaError reports a rate limit. RetryAfter is 0 when the provider gives no delay.
type QuotaError struct {
	RetryAfter time.Duration
}

func (e *QuotaError) Error() string {
	if e.RetryAfter == 0 {
		return ErrQuota.Error()
	}
	return fmt.Sprintf("%s, retry after %s", ErrQuota, e.RetryAfter)
}

func (e *QuotaError) Is(target error) bool { return target == ErrQuota }

// ExhaustedError is returned at once when no target can be called; RetryAt is the earliest
// instant one becomes available. Transient is true when only transient failures cool the targets down.
type ExhaustedError struct {
	RetryAt   time.Time
	Transient bool
}

func (e *ExhaustedError) Error() string {
	return fmt.Sprintf("%s until %s", ErrExhausted, e.RetryAt.Format(time.RFC3339))
}

func (e *ExhaustedError) Is(target error) bool { return target == ErrExhausted }
