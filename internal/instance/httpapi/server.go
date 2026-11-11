// Package httpapi serves the instance operations of api/openapi.yaml.
package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/instance/app"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

// Register lists every route of the instance operations; each handler sits in this package.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/instance/backup",
		httpserver.Handle(s.errs, http.StatusOK, s.getBackup))
	mux.HandleFunc("POST "+BaseURL+"/instance/backup",
		httpserver.Handle(s.errs, http.StatusOK, s.runBackup))
	mux.HandleFunc("PUT "+BaseURL+"/instance/backup/copy-password",
		httpserver.Handle(s.errs, http.StatusOK, s.setCopyPassword))
	mux.HandleFunc("GET "+BaseURL+"/instance/diagnostic", s.getDiagnostic)
	mux.HandleFunc("GET "+BaseURL+"/instance/version",
		httpserver.Handle(s.errs, http.StatusOK, s.getVersion))
	mux.HandleFunc("PUT "+BaseURL+"/instance/version/update-check",
		httpserver.Handle(s.errs, http.StatusOK, s.setUpdateCheck))
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
