package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const BaseURL = "/api/v1"

// ErrNotFound is returned by HolidayLister for an unknown calendar.
var ErrNotFound = errors.New("not found")

// HolidayLister is provided by the module root, which owns the calendar rules.
type HolidayLister func(ctx context.Context, calendar string, year int) ([]Holiday, error)

// CalendarLister is provided by the module root, which owns the calendar registry and the owner's region.
type CalendarLister func(ctx context.Context) (CalendarList, error)

// Service is the module root: instruments and prices (P8 amendments A59, A60).
type Service interface {
	DefineInstrument(ctx context.Context, in domain.Instrument) (domain.Instrument, error)
	ListInstruments(ctx context.Context, typ string) ([]domain.Instrument, error)
	Instrument(ctx context.Context, code string) (domain.Instrument, error)
	PutTerms(ctx context.Context, code string, t domain.Terms) (domain.Terms, error)
	Terms(ctx context.Context, code string) (domain.Terms, error)
	RecordPrices(ctx context.Context, ps []domain.Price) error
	ImportPrices(ctx context.Context, content []byte) (int, error)
	ListPrices(ctx context.Context, instrument, quote money.Currency, from, to time.Time) ([]domain.Price, error)
}

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	holidays  HolidayLister
	calendars CalendarLister
	svc       Service
	errs      httpserver.ErrorWriter
}

func NewServer(holidays HolidayLister, calendars CalendarLister, svc Service, log *slog.Logger) *Server {
	return &Server{holidays: holidays, calendars: calendars, svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
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

func (s *Server) ListCalendars(ctx context.Context, _ ListCalendarsRequestObject) (ListCalendarsResponseObject, error) {
	list, err := s.calendars(ctx)
	if err != nil {
		return nil, err
	}
	return ListCalendars200JSONResponse(list), nil
}

// NewHoliday builds the API representation; the module root uses it in its HolidayLister.
func NewHoliday(date openapi_types.Date, name, source string) Holiday {
	return Holiday{Date: date, Name: name, Source: HolidaySource(source)}
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d, true
	}
	switch {
	case errors.Is(err, ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "unknown calendar"), true
	case errors.Is(err, domain.ErrUnknownInstrument):
		return problem.New(http.StatusNotFound, "not_found", "unknown instrument"), true
	case errors.Is(err, domain.ErrNoTerms):
		return problem.New(http.StatusNotFound, "not_found", "the instrument has no terms"), true
	case errors.Is(err, domain.ErrInstrumentExists):
		return problem.New(http.StatusConflict, "instrument_exists", err.Error()), true
	}
	return problem.Details{}, false
}
