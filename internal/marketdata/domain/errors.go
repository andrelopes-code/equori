// Package domain holds the instruments and prices of the Market data context (docs/domain, 5.6).
package domain

import "errors"

var (
	ErrValidation         = errors.New("validation failed")
	ErrUnknownInstrument  = errors.New("unknown instrument")
	ErrInstrumentExists   = errors.New("instrument exists")
	ErrInstrumentInUse    = errors.New("instrument in use")
	ErrPriceMissing       = errors.New("price missing")
	ErrNoTerms            = errors.New("no terms")
	ErrUnknownIndex       = errors.New("unknown index")
	ErrUnknownInstitution = errors.New("unknown institution")
	ErrUnknownFeed        = errors.New("unknown feed")
	ErrAdminRequired      = errors.New("admin required")
	ErrRefreshRunning     = errors.New("refresh running")
	ErrNoSource           = errors.New("no source")
	ErrUnofficialSource   = errors.New("unofficial source")
	ErrOddLotCode         = errors.New("odd-lot code")
)

// FieldError names the request field that failed validation, as in the API.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return ErrValidation }

// OddLotCodeError is an instrument code that names the odd-lot market of RoundLot (A228 IO5).
type OddLotCodeError struct{ Code, RoundLot string }

func (e *OddLotCodeError) Error() string {
	return e.Code + " is " + e.RoundLot +
		" traded in the odd-lot market; register " + e.RoundLot
}

func (e *OddLotCodeError) Unwrap() error { return ErrOddLotCode }

func invalid(field, message string) error { return &FieldError{Field: field, Message: message} }
