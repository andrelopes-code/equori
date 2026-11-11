package domain

import "errors"

var ErrValidation = errors.New("validation failed")

// FieldError names the request field a rule rejected.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return ErrValidation }

func invalid(field, message string) error { return &FieldError{Field: field, Message: message} }
