package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

// ErrNotFound is returned by HolidayLister for an unknown calendar.
var ErrNotFound = errors.New("not found")

// HolidayLister is provided by the module root, which owns the calendar rules.
type HolidayLister func(ctx context.Context, calendar string, year int) ([]Holiday, error)

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	holidays HolidayLister
	errs     httpserver.ErrorWriter
}

func NewServer(holidays HolidayLister, log *slog.Logger) *Server {
	return &Server{holidays: holidays, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

func (s *Server) ListHolidays(ctx context.Context, req ListHolidaysRequestObject) (ListHolidaysResponseObject, error) {
	hs, err := s.holidays(ctx, req.Name, req.Params.Year)
	if err != nil {
		return nil, err
	}
	return ListHolidays200JSONResponse{Items: hs}, nil
}

// NewHoliday builds the API representation; the module root uses it in its HolidayLister.
func NewHoliday(date openapi_types.Date, name, source string) Holiday {
	return Holiday{Date: date, Name: name, Source: HolidaySource(source)}
}

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) (problem.Details, bool) {
	if errors.Is(err, ErrNotFound) {
		return problem.New(http.StatusNotFound, "not_found", "unknown calendar"), true
	}
	return problem.Details{}, false
}
