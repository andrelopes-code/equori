// Package domain holds the language model providers of a user and the rules of their chains.
package domain

import "errors"

var (
	ErrValidation        = errors.New("validation failed")
	ErrKeyRequired       = errors.New("the preset requires a key")
	ErrCapabilityMissing = errors.New("a model lacks a capability the use needs")
	ErrProviderNotFound  = errors.New("provider not found")
	ErrUseNotFound       = errors.New("use not found")
)

// FieldError names the request field a rule rejected.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return ErrValidation }

func invalid(field, message string) error { return &FieldError{Field: field, Message: message} }
