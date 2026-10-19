package httpapi

import (
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var errInvalidRequest = errors.New("invalid request")

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
	if errors.Is(err, errInvalidRequest) {
		return problem.New(http.StatusBadRequest, "invalid_request", "malformed request"), true
	}
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		code := "validation_failed"
		switch {
		case errors.Is(err, domain.ErrUnknownAccount):
			code = "invalid_account"
		case errors.Is(err, domain.ErrCurrencyUnsupported):
			code = "currency_unsupported"
		case errors.Is(err, app.ErrPriceMissing):
			code = "price_missing"
		}
		d := problem.New(http.StatusUnprocessableEntity, code, fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d, true
	}
	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	case errors.Is(err, domain.ErrVersionConflict):
		return problem.New(http.StatusConflict, "version_conflict", "the transaction changed since the expected version; reload it"), true
	case errors.Is(err, domain.ErrVoided):
		return problem.New(http.StatusConflict, "transaction_voided", "the transaction is voided"), true
	case errors.Is(err, app.ErrPairingAmbiguous):
		return problem.New(http.StatusConflict, "pairing_ambiguous", "several imported transactions can pair with this one; name one in pair_with"), true
	case errors.Is(err, domain.ErrNotCategorizable):
		return problem.New(http.StatusUnprocessableEntity, "not_categorizable", err.Error()), true
	case errors.Is(err, domain.ErrReconciled):
		return problem.New(http.StatusConflict, "posting_reconciled", "the transaction has reconciled postings"), true
	case errors.Is(err, app.ErrDifferenceRemains):
		return problem.New(http.StatusConflict, "difference_remains", err.Error()), true
	case errors.Is(err, domain.ErrAlreadyReconciled):
		return problem.New(http.StatusConflict, "already_reconciled", err.Error()), true
	case errors.Is(err, app.ErrSystemAccount):
		return problem.New(http.StatusUnprocessableEntity, "system_account", err.Error()), true
	case errors.Is(err, app.ErrNonZeroBalance), errors.Is(err, app.ErrPostingsAfterClose):
		return problem.New(http.StatusConflict, "account_not_empty", err.Error()), true
	case errors.Is(err, app.ErrLaterSaleExists):
		return problem.New(http.StatusConflict, "later_sale_exists", err.Error()), true
	case errors.Is(err, app.ErrInvestmentTransaction):
		return problem.New(http.StatusConflict, "investment_transaction", err.Error()), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	case errors.Is(err, app.ErrSettingsLocked):
		return problem.New(http.StatusConflict, "settings_locked", err.Error()), true
	case errors.Is(err, app.ErrStatementNotClosed):
		return problem.New(http.StatusConflict, "statement_not_closed", err.Error()), true
	case errors.Is(err, app.ErrStatementFinanced):
		return problem.New(http.StatusConflict, "statement_financed", err.Error()), true
	case errors.Is(err, app.ErrDisputeOpen):
		return problem.New(http.StatusConflict, "dispute_open", err.Error()), true
	case errors.Is(err, app.ErrDisputeResolved):
		return problem.New(http.StatusConflict, "dispute_resolved", err.Error()), true
	default:
		return problem.Details{}, false
	}
}
