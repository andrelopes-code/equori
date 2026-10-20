package tool

import (
	"errors"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var (
	ErrNoUser      = errors.New("tool call without a user")
	ErrUnknownTool = errors.New("unknown tool")
)

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error is the result of a failed call, in the vocabulary of Problem.code (ADR 012 T7). A
// handler returns *Error for an argument value it cannot use.
type Error struct {
	Code   string       `json:"code"`
	Detail string       `json:"detail"`
	Errors []FieldError `json:"errors,omitzero"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Detail }

func invalidArguments(detail string) *Error { return &Error{Code: "invalid_arguments", Detail: detail} }

// FromProblem reuses a module's HTTP error mapping for its tools.
func FromProblem(m func(error) (problem.Details, bool)) func(error) (Error, bool) {
	return func(err error) (Error, bool) {
		d, ok := m(err)
		if !ok {
			return Error{}, false
		}
		e := Error{Code: d.Code, Detail: d.Detail}
		for _, f := range d.Errors {
			e.Errors = append(e.Errors, FieldError{Field: f.Field, Message: f.Message})
		}
		return e, true
	}
}
