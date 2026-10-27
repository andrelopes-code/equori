// Package domain holds the instruments and prices of the Market data context (docs/domain, 5.6).
package domain

import "errors"

var (
	ErrValidation        = errors.New("validation failed")
	ErrUnknownInstrument = errors.New("unknown instrument")
	ErrInstrumentExists  = errors.New("instrument exists")
	ErrPriceMissing      = errors.New("price missing")
	ErrNoTerms           = errors.New("no terms")
	ErrUnknownIndex      = errors.New("unknown index")
	ErrUnknownFeed       = errors.New("unknown feed")
	ErrAdminRequired     = errors.New("admin required")
	ErrRefreshRunning    = errors.New("refresh running")
)

// FieldError names the request field that failed validation, as in the API.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return ErrValidation }

func invalid(field, message string) error { return &FieldError{Field: field, Message: message} }
