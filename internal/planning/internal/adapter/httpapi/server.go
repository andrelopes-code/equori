package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
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
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
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

func fieldProblem(status int, code string, field, message string) problem.Details {
	d := problem.New(status, code, field+": "+message)
	d.Errors = []problem.FieldError{{Field: field, Message: message}}
	return d
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if pe, ok := errors.AsType[*paramError](err); ok {
		return fieldProblem(http.StatusBadRequest, "invalid_request", pe.field, pe.message), true
	}
	if ce, ok := errors.AsType[*app.CurrencyError](err); ok {
		return fieldProblem(http.StatusUnprocessableEntity, "currency_unsupported", ce.Field, app.ErrCurrencyUnsupported.Error()), true
	}
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		return fieldProblem(http.StatusUnprocessableEntity, "validation_failed", fe.Field, fe.Message), true
	}
	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	case errors.Is(err, app.ErrPriceMissing):
		return problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error()), true
	case errors.Is(err, app.ErrOccurrenceClosed):
		return problem.New(http.StatusConflict, "occurrence_closed", err.Error()), true
	case errors.Is(err, app.ErrTransactionInUse):
		return problem.New(http.StatusConflict, "transaction_in_use", err.Error()), true
	case errors.Is(err, app.ErrPauseOverlap):
		return problem.New(http.StatusConflict, "pause_overlap", err.Error()), true
	case errors.Is(err, app.ErrScheduleEnded):
		return problem.New(http.StatusConflict, "schedule_ended", err.Error()), true
	case errors.Is(err, app.ErrBudgetExists):
		return problem.New(http.StatusConflict, "budget_exists", err.Error()), true
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

func toPricesAPI(ps []app.Price) *[]Price {
	if len(ps) == 0 {
		return nil
	}
	out := make([]Price, len(ps))
	for i, p := range ps {
		out[i] = Price{
			Instrument: string(p.Instrument), QuoteInstrument: string(p.Quote), Date: apiDate(p.Date),
			Value: p.Value.Reduced().String(), Source: p.Source,
		}
	}
	return &out
}

func toMoneyAPI(amount int64, c money.Currency) Money {
	return Money{Amount: amount, Currency: string(c)}
}

func fromMoneyAPI(field string, m Money) (money.Money, error) {
	v, err := money.New(m.Amount, money.Currency(m.Currency))
	if err != nil {
		return money.Money{}, &domain.FieldError{Field: field, Message: err.Error(), Err: domain.ErrValidation}
	}
	return v, nil
}

// location is the Location header of a created record (ADR 007, C6).
func location(collection string, id uuid.UUID) *string {
	l := BaseURL + collection + id.String()
	return &l
}

func apiDate(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }

func optDate(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}
	t := d.Time
	return &t
}

func apiOptDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}
	return &openapi_types.Date{Time: *t}
}

func optUUID(id *openapi_types.UUID) uuid.UUID {
	if id == nil {
		return uuid.Nil
	}
	return *id
}

func apiOptUUID(id uuid.UUID) *openapi_types.UUID {
	if id == uuid.Nil {
		return nil
	}
	return &id
}
