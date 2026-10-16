package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

// paramError is a parameter that conforms to the contract but whose value the handler cannot use.
type paramError struct{ field, message string }

func (e *paramError) Error() string { return e.field + ": " + e.message }

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) (problem.Details, bool) {
	if pe, ok := errors.AsType[*paramError](err); ok {
		d := problem.New(http.StatusBadRequest, "invalid_request", pe.Error())
		d.Errors = []problem.FieldError{{Field: pe.field, Message: pe.message}}
		return d, true
	}
	fe, ok := errors.AsType[*domain.FieldError](err)
	if !ok && errors.Is(err, app.ErrAliasExists) {
		fe, ok = &domain.FieldError{Field: "pattern", Message: err.Error()}, true
	}
	if ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d, true
	}
	if errors.Is(err, app.ErrNotFound) {
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	}
	return problem.Details{}, false
}

func listPage[K any](limit *int, cursor *string) (page.Request[K], error) {
	r, err := page.Read[K](limit, cursor)
	switch {
	case errors.Is(err, page.ErrInvalidLimit):
		return r, &paramError{field: "limit", message: "must be between 1 and 200"}
	case errors.Is(err, page.ErrInvalidCursor):
		return r, &paramError{field: "cursor", message: "is not a cursor of this list"}
	}
	return r, err
}
