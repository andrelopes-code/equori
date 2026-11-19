package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
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

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/schedules",
		httpserver.Handle(s.errs, http.StatusOK, s.listSchedules))
	mux.HandleFunc("POST "+BaseURL+"/schedules", httpserver.HandleCreated(s.errs, s.createSchedule))
	mux.HandleFunc("GET "+BaseURL+"/schedules/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getSchedule))
	mux.HandleFunc("PATCH "+BaseURL+"/schedules/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.updateScheduleMatching))
	mux.HandleFunc("GET "+BaseURL+"/occurrences",
		httpserver.Handle(s.errs, http.StatusOK, s.listOccurrences))
	mux.HandleFunc("POST "+BaseURL+"/occurrences/{id}/realize",
		httpserver.Handle(s.errs, http.StatusOK, s.realizeOccurrence))
	mux.HandleFunc("POST "+BaseURL+"/occurrences/{id}/skip",
		httpserver.Handle(s.errs, http.StatusOK, s.skipOccurrence))
	mux.HandleFunc("POST "+BaseURL+"/occurrences/{id}/move",
		httpserver.Handle(s.errs, http.StatusOK, s.moveOccurrence))
	mux.HandleFunc("POST "+BaseURL+"/schedules/{id}/terms",
		httpserver.Handle(s.errs, http.StatusCreated, s.changeScheduleTerms))
	mux.HandleFunc("POST "+BaseURL+"/schedules/{id}/pauses",
		httpserver.Handle(s.errs, http.StatusCreated, s.pauseSchedule))
	mux.HandleFunc("POST "+BaseURL+"/schedules/{id}/end",
		httpserver.Handle(s.errs, http.StatusOK, s.endSchedule))
	mux.HandleFunc("GET "+BaseURL+"/budgets",
		httpserver.Handle(s.errs, http.StatusOK, s.listBudgets))
	mux.HandleFunc("POST "+BaseURL+"/budgets", httpserver.HandleCreated(s.errs, s.createBudget))
	mux.HandleFunc("GET "+BaseURL+"/budgets/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudget))
	mux.HandleFunc("DELETE "+BaseURL+"/budgets/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteBudget))
	mux.HandleFunc("POST "+BaseURL+"/budgets/{id}/amounts",
		httpserver.Handle(s.errs, http.StatusCreated, s.addBudgetAmount))
	mux.HandleFunc("GET "+BaseURL+"/budgets/{id}/progress",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetProgress))
	mux.HandleFunc("GET "+BaseURL+"/goals",
		httpserver.Handle(s.errs, http.StatusOK, s.listGoals))
	mux.HandleFunc("POST "+BaseURL+"/goals", httpserver.HandleCreated(s.errs, s.createGoal))
	mux.HandleFunc("GET "+BaseURL+"/goals/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getGoal))
	mux.HandleFunc("PATCH "+BaseURL+"/goals/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.updateGoal))
	mux.HandleFunc("DELETE "+BaseURL+"/goals/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteGoal))
	mux.HandleFunc("GET "+BaseURL+"/goals/{id}/allocations",
		httpserver.Handle(s.errs, http.StatusOK, s.listGoalAllocations))
	mux.HandleFunc("POST "+BaseURL+"/goals/{id}/allocations",
		httpserver.Handle(s.errs, http.StatusOK, s.createGoalAllocation))
	mux.HandleFunc("DELETE "+BaseURL+"/goals/{id}/allocations/{allocation_id}",
		httpserver.Handle(s.errs, http.StatusNoContent, s.deleteGoalAllocation))
	mux.HandleFunc("GET "+BaseURL+"/goals/{id}/expenses",
		httpserver.Handle(s.errs, http.StatusOK, s.listGoalExpenses))
	mux.HandleFunc("PUT "+BaseURL+"/goals/{id}/expenses/{transaction_id}",
		httpserver.Handle(s.errs, http.StatusNoContent, s.linkGoalExpense))
	mux.HandleFunc("DELETE "+BaseURL+"/goals/{id}/expenses/{transaction_id}",
		httpserver.Handle(s.errs, http.StatusNoContent, s.unlinkGoalExpense))
	mux.HandleFunc("GET "+BaseURL+"/accounts/{id}/projection",
		httpserver.Handle(s.errs, http.StatusOK, s.getProjection))
	mux.HandleFunc("GET "+BaseURL+"/commitments",
		httpserver.Handle(s.errs, http.StatusOK, s.getCommitted))
	mux.HandleFunc("GET "+BaseURL+"/budget-plan",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetPlan))
	mux.HandleFunc("PUT "+BaseURL+"/budget-plan",
		httpserver.Handle(s.errs, http.StatusOK, s.saveBudgetPlan))
	mux.HandleFunc("GET "+BaseURL+"/budget-buckets/history",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetBucketHistory))
	mux.HandleFunc("GET "+BaseURL+"/budget-buckets/entries",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetBucketEntries))
	mux.HandleFunc("GET "+BaseURL+"/budget-buckets/versions",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetBucketVersions))
	mux.HandleFunc("DELETE "+BaseURL+"/budget-buckets/versions/{from}",
		httpserver.Handle(s.errs, http.StatusNoContent, s.deleteBudgetBucketVersion))
	mux.HandleFunc("GET "+BaseURL+"/budget-buckets",
		httpserver.Handle(s.errs, http.StatusOK, s.getBudgetBuckets))
	mux.HandleFunc("PUT "+BaseURL+"/budget-buckets",
		httpserver.Handle(s.errs, http.StatusNoContent, s.saveBudgetBuckets))
	mux.HandleFunc("POST "+BaseURL+"/occurrences/{id}/reopen",
		httpserver.Handle(s.errs, http.StatusOK, s.reopenOccurrence))
	mux.HandleFunc("POST "+BaseURL+"/occurrences/{id}/unrealize",
		httpserver.Handle(s.errs, http.StatusOK, s.unrealizeOccurrence))
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
		return fieldProblem(
			http.StatusUnprocessableEntity,
			"currency_unsupported",
			ce.Field,
			app.ErrCurrencyUnsupported.Error(),
		), true
	}

	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		return fieldProblem(
			http.StatusUnprocessableEntity,
			"validation_failed",
			fe.Field,
			fe.Message,
		), true
	}

	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	case errors.Is(err, app.ErrPriceMissing):
		d := problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error())

		return problem.WithMissingPrice(d, err), true
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
			Instrument: string(
				p.Instrument,
			),
			QuoteInstrument: string(p.Quote),
			Date:            apiDate(p.Date),
			Value:           p.Value.Reduced().String(),
			Source:          p.Source,
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
		return money.Money{}, &domain.FieldError{
			Field:   field,
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	return v, nil
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
