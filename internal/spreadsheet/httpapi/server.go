// Package httpapi serves the spreadsheet operations of api/openapi.yaml.
package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/spreadsheet/app"
	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/spreadsheets",
		httpserver.Handle(s.errs, http.StatusOK, s.listSpreadsheets))
	mux.HandleFunc("POST "+BaseURL+"/spreadsheets",
		httpserver.HandleCreated(s.errs, s.createSpreadsheet))
	mux.HandleFunc("GET "+BaseURL+"/spreadsheets/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getSpreadsheet))
	mux.HandleFunc("PUT "+BaseURL+"/spreadsheets/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.saveSpreadsheet))
	mux.HandleFunc("DELETE "+BaseURL+"/spreadsheets/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteSpreadsheet))
	mux.HandleFunc("PUT "+BaseURL+"/spreadsheets/{id}/name",
		httpserver.Handle(s.errs, http.StatusOK, s.renameSpreadsheet))
	mux.HandleFunc("POST "+BaseURL+"/spreadsheets/{id}/copies",
		httpserver.HandleCreated(s.errs, s.copySpreadsheet))
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}

		return d, true
	}

	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	case errors.Is(err, app.ErrVersionConflict):
		return problem.New(http.StatusConflict, "version_conflict", err.Error()), true
	case errors.Is(err, app.ErrLimitReached):
		return problem.New(http.StatusConflict, "spreadsheet_limit_reached", err.Error()), true
	}

	return problem.Details{}, false
}
