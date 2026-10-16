package aistudio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

const retryInfoType = "type.googleapis.com/google.rpc.RetryInfo"

// apiError is the Google API error body: {"error": {"code", "message", "status", "details"}}.
type apiError struct {
	Error struct {
		Message string `json:"message"`
		Details []struct {
			Type       string `json:"@type"`
			RetryDelay string `json:"retryDelay"`
		} `json:"details"`
	} `json:"error"`
}

// statusError classifies a non-200 response for the Router (spec table "Provider port").
func statusError(model string, status int, body []byte) error {
	var e apiError
	_ = json.Unmarshal(body, &e) // a body that is not JSON leaves e empty
	prefix := fmt.Sprintf("aistudio %s: status %d", model, status)
	if e.Error.Message != "" {
		prefix += ": " + e.Error.Message
	}
	switch status {
	case http.StatusTooManyRequests:
		return fmt.Errorf("%s: %w", prefix, &llm.QuotaError{RetryAfter: retryAfter(e)})
	case http.StatusBadRequest, http.StatusNotFound:
		return fmt.Errorf("%s: %w", prefix, llm.ErrInvalidRequest)
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("%s: %w", prefix, llm.ErrUnauthorized)
	case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return fmt.Errorf("%s: %w", prefix, llm.ErrTransient)
	default:
		return fmt.Errorf("%s", prefix)
	}
}

// retryAfter reads google.rpc.RetryInfo.retryDelay ("37s"); 0 when absent or unreadable.
func retryAfter(e apiError) time.Duration {
	for _, d := range e.Error.Details {
		if d.Type != retryInfoType {
			continue
		}
		if delay, err := time.ParseDuration(d.RetryDelay); err == nil && delay > 0 {
			return delay
		}
	}
	return 0
}
