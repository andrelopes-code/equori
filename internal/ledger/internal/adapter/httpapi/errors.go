package httpapi

import (
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var errInvalidRequest = errors.New("invalid request")

func (s *Server) writeRequestError(w http.ResponseWriter, r *http.Request, err error) {
	s.writeError(w, r, errors.Join(errInvalidRequest, err))
}

func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	d := toProblem(err)
	d.RequestID = httpserver.RequestID(r.Context())
	if d.Status >= http.StatusInternalServerError {
		s.log.ErrorContext(r.Context(), "request failed", "error", err, "request_id", d.RequestID)
	}
	problem.Write(w, d)
}

// toProblem maps errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) problem.Details {
	if d, ok := problem.Transport(err); ok {
		return d
	}
	if errors.Is(err, errInvalidRequest) {
		return problem.New(http.StatusBadRequest, "invalid_request", "malformed request")
	}
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		code := "validation_failed"
		if errors.Is(err, domain.ErrUnknownAccount) {
			code = "invalid_account"
		}
		d := problem.New(http.StatusUnprocessableEntity, code, fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d
	}
	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found")
	case errors.Is(err, domain.ErrVersionConflict):
		return problem.New(http.StatusConflict, "version_conflict", "the transaction changed since the expected version; reload it")
	case errors.Is(err, domain.ErrVoided):
		return problem.New(http.StatusConflict, "transaction_voided", "the transaction is voided")
	case errors.Is(err, domain.ErrReconciled):
		return problem.New(http.StatusConflict, "posting_reconciled", "the transaction has reconciled postings")
	case errors.Is(err, app.ErrNonZeroBalance), errors.Is(err, app.ErrPostingsAfterClose):
		return problem.New(http.StatusConflict, "account_not_empty", err.Error())
	case errors.Is(err, app.ErrSettingsLocked):
		return problem.New(http.StatusConflict, "settings_locked", err.Error())
	case errors.Is(err, app.ErrStatementNotClosed):
		return problem.New(http.StatusConflict, "statement_not_closed", err.Error())
	case errors.Is(err, app.ErrStatementFinanced):
		return problem.New(http.StatusConflict, "statement_financed", err.Error())
	default:
		return problem.New(http.StatusInternalServerError, "internal_error", "")
	}
}
