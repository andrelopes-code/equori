// Package domain holds the ledger entities and their invariants (docs/domain, chapter 5).
package domain

import "errors"

var (
	ErrValidation       = errors.New("validation failed")
	ErrUnknownAccount   = errors.New("unknown account")
	ErrUnbalanced       = errors.New("transaction is unbalanced")
	ErrTooFewPostings   = errors.New("transaction needs at least two postings")
	ErrAccountClosed    = errors.New("account is not open on the transaction date")
	ErrCurrencyMismatch = errors.New("currency mismatch")
	ErrVersionConflict  = errors.New("version conflict")
	ErrVoided           = errors.New("transaction is voided")
	ErrReconciled       = errors.New("transaction has reconciled postings")
	// ErrCurrencyUnsupported: the operation does not take an account of this currency (P8 A66, A67).
	ErrCurrencyUnsupported = errors.New("currency unsupported")
)

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
