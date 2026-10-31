// Package httpapi serves the instance operations of api/openapi.yaml.
package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/instance/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrAdminRequired):
		return problem.New(http.StatusForbidden, "admin_required", app.ErrAdminRequired.Error()), true
	case errors.Is(err, app.ErrBackupOff):
		return problem.New(http.StatusConflict, "backup_off", app.ErrBackupOff.Error()), true
	case errors.Is(err, app.ErrBackupFailed):
		// The cause stays out of the response: pg_dump output can carry row values (A158).
		return problem.New(http.StatusInternalServerError, "backup_failed", app.ErrBackupFailed.Error()), true
	case errors.Is(err, app.ErrPasswordTooShort):
		return problem.New(http.StatusBadRequest, "password_too_short", app.ErrPasswordTooShort.Error()), true
	case errors.Is(err, app.ErrSecretKeyMissing):
		return problem.New(http.StatusConflict, "secret_key_missing", app.ErrSecretKeyMissing.Error()), true
	}

	return problem.Details{}, false
}
