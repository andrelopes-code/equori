package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

const BaseURL = "/api/v1"

type Server struct {
	svc     *app.Service
	exports *app.Exports
	clock   app.Clock
	errs    httpserver.ErrorWriter
}

func NewServer(svc *app.Service, exports *app.Exports, clk app.Clock, log *slog.Logger) *Server {
	return &Server{svc: svc, exports: exports, clock: clk, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST "+BaseURL+"/exports", s.requestExport)
	mux.HandleFunc("GET "+BaseURL+"/exports/current",
		httpserver.Handle(s.errs, http.StatusOK, s.getExport))
	mux.HandleFunc("GET "+BaseURL+"/exports/current/content", s.getExportContent)
	mux.HandleFunc("POST "+BaseURL+"/imports/archive", s.importArchive)
	mux.HandleFunc("GET "+BaseURL+"/statements/{id}/analytics",
		httpserver.Handle(s.errs, http.StatusOK, s.getStatementAnalytics))
	mux.HandleFunc("GET "+BaseURL+"/accounts/{id}/statement-analytics",
		httpserver.Handle(s.errs, http.StatusOK, s.getCardStatementAnalytics))
	mux.HandleFunc("GET "+BaseURL+"/reports/balances",
		httpserver.Handle(s.errs, http.StatusOK, s.getBalanceSeries))
	mux.HandleFunc("GET "+BaseURL+"/reports/flows",
		httpserver.Handle(s.errs, http.StatusOK, s.getAccountFlows))
	mux.HandleFunc("GET "+BaseURL+"/reports/categories",
		httpserver.Handle(s.errs, http.StatusOK, s.getCategoryTotals))
	mux.HandleFunc("GET "+BaseURL+"/reports/categories/{id}/cash-payments",
		httpserver.Handle(s.errs, http.StatusOK, s.listCategoryCashPayments))
	mux.HandleFunc("GET "+BaseURL+"/reports/indicators",
		httpserver.Handle(s.errs, http.StatusOK, s.getIndicators))
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	var tooNew *app.ArchiveTooNewError
	switch {
	case errors.Is(err, app.ErrInvalidRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the range must not exceed 3660 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 3660 days after it"}}

		return d, true
	case errors.Is(err, app.ErrInvalidCategoryRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the period must not exceed 366 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 365 days after it"}}

		return d, true
	case errors.Is(err, app.ErrInvalidMonth):
		d := problem.New(http.StatusBadRequest, "invalid_request", "month must not be after the current month")
		d.Errors = []problem.FieldError{{Field: "month", Message: "must not be after the current month"}}

		return d, true
	case errors.Is(err, app.ErrPriceMissing):
		return problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error()), true
	case errors.Is(err, app.ErrInvalidFlowRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the range must not exceed 366 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 365 days after it"}}

		return d, true
	case errors.Is(err, errFileRequired):
		d := problem.New(http.StatusBadRequest, "invalid_request", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: "is required"}}

		return d, true
	case errors.Is(err, app.ErrArchiveInvalid):
		d := problem.New(http.StatusUnprocessableEntity, "archive_invalid", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: err.Error()}}

		return d, true
	case errors.As(err, &tooNew):
		d := problem.New(http.StatusUnprocessableEntity, "archive_too_new", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: err.Error()}}
		d.ArchiveVersion, d.InstanceVersion = &tooNew.Archive, &tooNew.Instance

		return d, true
	case errors.Is(err, app.ErrPassphraseLength):
		d := problem.New(http.StatusBadRequest, "invalid_request", err.Error())
		d.Errors = []problem.FieldError{{Field: "credentials_passphrase", Message: err.Error()}}

		return d, true
	case errors.Is(err, app.ErrPassphraseRequired):
		d := problem.New(http.StatusUnprocessableEntity, "passphrase_required", err.Error())
		d.Errors = []problem.FieldError{{Field: "passphrase", Message: err.Error()}}

		return d, true
	case errors.Is(err, app.ErrPassphraseInvalid):
		d := problem.New(http.StatusUnprocessableEntity, "passphrase_invalid", err.Error())
		d.Errors = []problem.FieldError{{Field: "passphrase", Message: err.Error()}}

		return d, true
	case errors.Is(err, app.ErrCredentialsUnavailable):
		return problem.New(http.StatusConflict, "integration_unavailable", err.Error()), true
	case errors.Is(err, app.ErrCredentialsRole):
		return problem.New(http.StatusForbidden, "book_role_required", err.Error()), true
	case errors.Is(err, app.ErrImportNotEmpty):
		return problem.New(http.StatusConflict, "import_not_empty", err.Error()), true
	case errors.Is(err, app.ErrConfirmationMismatch):
		d := problem.New(http.StatusUnprocessableEntity, "confirmation_mismatch", err.Error())
		d.Errors = []problem.FieldError{{Field: "replace_books_name", Message: "must equal the name of the book"}}

		return d, true
	case errors.Is(err, app.ErrImportConflict):
		return problem.New(http.StatusConflict, "import_conflict", err.Error()), true
	case errors.Is(err, app.ErrExportNotFound):
		return problem.New(http.StatusNotFound, "not_found", err.Error()), true
	case errors.Is(err, app.ErrExportPending):
		return problem.New(http.StatusConflict, "export_pending", err.Error()), true
	case errors.Is(err, app.ErrExportNotReady):
		return problem.New(http.StatusConflict, "export_not_ready", err.Error()), true
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	}

	return problem.Details{}, false
}
