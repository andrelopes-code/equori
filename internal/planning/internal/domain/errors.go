// Package domain holds schedules, occurrences, budgets and goals of the Planning context (docs/domain, 5.3).
package domain

import "errors"

var ErrValidation = errors.New("validation failed")

// FieldError names the input field that broke a rule; Err is the sentinel callers match.
type FieldError struct {
	Field   string
	Message string
	Err     error
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return e.Err }

func invalid(field, message string) *FieldError {
	return &FieldError{Field: field, Message: message, Err: ErrValidation}
}
