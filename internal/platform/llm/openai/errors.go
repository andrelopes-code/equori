package openai

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// statusError classifies a non-200 response for the Router (ADR 019). The body is left out:
// a compatible host may echo the request in it.
func statusError(what string, status int, header http.Header) error {
	prefix := fmt.Sprintf("openai %s: status %d", what, status)
	switch {
	case status == http.StatusTooManyRequests:
		return fmt.Errorf("%s: %w", prefix, &llm.QuotaError{RetryAfter: retryAfter(header)})
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return fmt.Errorf("%s: %w", prefix, llm.ErrUnauthorized)
	case status == http.StatusBadRequest || status == http.StatusNotFound ||
		status == http.StatusRequestEntityTooLarge || status == http.StatusUnprocessableEntity:
		return fmt.Errorf("%s: %w", prefix, llm.ErrInvalidRequest)
	case status >= 500:
		return fmt.Errorf("%s: %w", prefix, llm.ErrTransient)
	default:
		return fmt.Errorf("%s", prefix)
	}
}

// retryAfter reads Retry-After in seconds; 0 when absent or in HTTP-date form.
func retryAfter(h http.Header) time.Duration {
	s, err := strconv.Atoi(h.Get("Retry-After"))
	if err != nil || s <= 0 {
		return 0
	}
	return time.Duration(s) * time.Second
}
