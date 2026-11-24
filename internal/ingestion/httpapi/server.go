package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
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
	mux.HandleFunc("GET "+BaseURL+"/ingestion/sync-schedule",
		httpserver.Handle(s.errs, http.StatusOK, s.getSyncSchedule))
	mux.HandleFunc("PUT "+BaseURL+"/ingestion/sync-schedule",
		httpserver.Handle(s.errs, http.StatusOK, s.setSyncSchedule))
	mux.HandleFunc("GET "+BaseURL+"/import-batches",
		httpserver.Handle(s.errs, http.StatusOK, s.listImportBatches))
	mux.HandleFunc("GET "+BaseURL+"/accounts/{id}/csv-profile",
		httpserver.Handle(s.errs, http.StatusOK, s.getCsvProfile))
	mux.HandleFunc("PUT "+BaseURL+"/accounts/{id}/csv-profile",
		httpserver.Handle(s.errs, http.StatusOK, s.saveCsvProfile))
	mux.HandleFunc("POST "+BaseURL+"/accounts/{id}/csv-profile/suggestion",
		httpserver.Handle(s.errs, http.StatusOK, s.suggestCsvColumns))
	mux.HandleFunc("POST "+BaseURL+"/accounts/{id}/imports", s.importFile)
	mux.HandleFunc("GET "+BaseURL+"/import-batches/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getImportBatch))
	mux.HandleFunc("GET "+BaseURL+"/import-batches/{id}/records",
		httpserver.Handle(s.errs, http.StatusOK, s.listBatchRecords))
	mux.HandleFunc("GET "+BaseURL+"/accounts/{id}/unconfirmed",
		httpserver.Handle(s.errs, http.StatusOK, s.listUnconfirmed))
	mux.HandleFunc("POST "+BaseURL+"/external-records/{id}/reopen",
		httpserver.Handle(s.errs, http.StatusOK, s.reopenExternalRecord))
	mux.HandleFunc("POST "+BaseURL+"/external-records/{id}/resolve",
		httpserver.Handle(s.errs, http.StatusOK, s.resolveExternalRecord))
	mux.HandleFunc("POST "+BaseURL+"/external-records/resolve",
		httpserver.Handle(s.errs, http.StatusOK, s.resolveExternalRecords))
	mux.HandleFunc("POST "+BaseURL+"/external-records/{id}/undo",
		httpserver.Handle(s.errs, http.StatusOK, s.undoExternalRecordDecision))
	mux.HandleFunc("GET "+BaseURL+"/aggregators",
		httpserver.Handle(s.errs, http.StatusOK, s.listAggregators))
	mux.HandleFunc("GET "+BaseURL+"/integrations",
		httpserver.Handle(s.errs, http.StatusOK, s.listIntegrations))
	mux.HandleFunc(
		"POST "+BaseURL+"/integrations",
		httpserver.HandleCreated(s.errs, s.createIntegration),
	)
	mux.HandleFunc("GET "+BaseURL+"/integrations/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getIntegration))
	mux.HandleFunc("DELETE "+BaseURL+"/integrations/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteIntegration))
	mux.HandleFunc("PUT "+BaseURL+"/integrations/{id}/credentials",
		httpserver.Handle(s.errs, http.StatusOK, s.updateIntegrationCredentials))
	mux.HandleFunc("POST "+BaseURL+"/integrations/{id}/connect-token",
		httpserver.Handle(s.errs, http.StatusOK, s.createConnectToken))
	mux.HandleFunc("GET "+BaseURL+"/connections",
		httpserver.Handle(s.errs, http.StatusOK, s.listConnections))
	mux.HandleFunc(
		"POST "+BaseURL+"/connections",
		httpserver.HandleCreated(s.errs, s.createConnection),
	)
	mux.HandleFunc("GET "+BaseURL+"/connections/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.getConnection))
	mux.HandleFunc("DELETE "+BaseURL+"/connections/{id}",
		httpserver.Handle(s.errs, http.StatusOK, s.deleteConnection))
	mux.HandleFunc("POST "+BaseURL+"/connections/{id}/sync",
		httpserver.Handle(s.errs, http.StatusOK, s.syncConnection))
	mux.HandleFunc("GET "+BaseURL+"/connections/{id}/syncs",
		httpserver.Handle(s.errs, http.StatusOK, s.listConnectionSyncs))
	mux.HandleFunc("GET "+BaseURL+"/connections/{id}/investments",
		httpserver.Handle(s.errs, http.StatusOK, s.listConnectionInvestments))
	mux.HandleFunc("POST "+BaseURL+"/investment-movements/{id}/confirm",
		httpserver.Handle(s.errs, http.StatusOK, s.confirmInvestmentMovement))
	mux.HandleFunc("POST "+BaseURL+"/investment-movements/{id}/dismiss",
		httpserver.Handle(s.errs, http.StatusOK, s.dismissInvestmentMovement))
	mux.HandleFunc("POST "+BaseURL+"/investment-movements/{id}/undo",
		httpserver.Handle(s.errs, http.StatusOK, s.undoInvestmentMovement))
	mux.HandleFunc("PUT "+BaseURL+"/connections/{id}/accounts/{external_account_id}",
		httpserver.Handle(s.errs, http.StatusOK, s.mapExternalAccount))
}

// paramError is a parameter that conforms to the contract but whose value the handler cannot use.
type paramError struct{ field, message string }

func (e *paramError) Error() string { return e.field + ": " + e.message }

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if pe, ok := errors.AsType[*paramError](err); ok {
		d := problem.New(http.StatusBadRequest, "invalid_request", pe.Error())
		d.Errors = []problem.FieldError{{Field: pe.field, Message: pe.message}}

		return d, true
	}

	if ue, ok := errors.AsType[*app.UnauthorizedError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "aggregator_unauthorized", ue.Error())
		d.Errors = []problem.FieldError{{Field: ue.Field, Message: "rejected by the aggregator"}}

		return d, true
	}

	if lr, ok := errors.AsType[*app.LedgerRefusal](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, lr.Code, lr.Message)
		if lr.Field != "" {
			d.Errors = []problem.FieldError{{Field: lr.Field, Message: lr.Message}}
		}

		return d, true
	}

	if bo, ok := errors.AsType[*app.LinesBeforeOpening](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "lines_before_opening", bo.Error())
		d.BeforeOpening = &problem.BeforeOpening{
			OpenedOn:    bo.OpenedOn.Format(time.DateOnly),
			FirstLineOn: bo.FirstLine.Format(time.DateOnly),
		}

		return d, true
	}

	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}

		return d, true
	}

	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "resource not found"), true
	case errors.Is(err, app.ErrMovementResolved):
		return problem.New(http.StatusConflict, "investment_movement_resolved", err.Error()), true
	case errors.Is(err, app.ErrInvestmentNotApplied):
		return problem.New(http.StatusConflict, "investment_not_applied", err.Error()), true
	case errors.Is(err, app.ErrLaterMovementConfirmed):
		return problem.New(http.StatusConflict, "later_movement_confirmed", err.Error()), true
	case errors.Is(err, app.ErrAdminRequired):
		return problem.New(http.StatusForbidden, "admin_required", err.Error()), true
	case errors.Is(err, app.ErrRecordResolved):
		return problem.New(http.StatusConflict, "record_resolved", err.Error()), true
	case errors.Is(err, app.ErrRecordNotDiscarded):
		return problem.New(http.StatusConflict, "record_not_discarded", err.Error()), true
	case errors.Is(err, app.ErrNoDecision):
		return problem.New(http.StatusConflict, "no_decision", err.Error()), true
	case errors.Is(err, app.ErrGroupChanged):
		return problem.New(http.StatusConflict, "group_changed", err.Error()), true
	case errors.Is(err, app.ErrAlreadyMatched):
		return problem.New(http.StatusConflict, "already_matched", err.Error()), true
	case errors.Is(err, app.ErrTransactionVoided):
		return problem.New(http.StatusConflict, "transaction_voided", err.Error()), true
	case errors.Is(err, app.ErrReconciled):
		return problem.New(http.StatusConflict, "posting_reconciled", err.Error()), true
	case errors.Is(err, app.ErrIntegrationUnavailable):
		return problem.New(http.StatusConflict, "integration_unavailable", err.Error()), true
	case errors.Is(err, app.ErrIntegrationInUse):
		return problem.New(
			http.StatusConflict,
			"integration_in_use",
			"delete the integration's connections first",
		), true
	case errors.Is(err, app.ErrColumnSuggesterUnavailable):
		// The cause stays out of the response: it may name a provider.
		return problem.New(
			http.StatusServiceUnavailable,
			"csv_suggestion_unavailable",
			app.ErrColumnSuggesterUnavailable.Error(),
		), true
	case errors.Is(err, domain.ErrColumnSuggestionUnusable):
		return problem.New(
			http.StatusUnprocessableEntity,
			"csv_suggestion_unusable",
			err.Error(),
		), true
	case errors.Is(err, app.ErrAggregatorUnavailable):
		// The cause stays out of the response: it may name the aggregator's address.
		return problem.New(
			http.StatusBadGateway,
			"aggregator_unavailable",
			app.ErrAggregatorUnavailable.Error(),
		), true
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

func toBatchAPI(b domain.Batch) ImportBatch {
	out := ImportBatch{
		Id:                b.ID,
		AccountId:         b.AccountID,
		Source:            ImportBatchSource(b.Source),
		FileName:          ref(b.FileName),
		ExternalAccountId: b.ExternalAccountID,
		Counts: ImportCounts{
			Received:     b.Counts.Received,
			Ignored:      b.Counts.Ignored,
			Matched:      b.Counts.Matched,
			Created:      b.Counts.Created,
			NeedsReview:  b.Counts.NeedsReview,
			Discarded:    b.Counts.Discarded,
			Updated:      b.Counts.Updated,
			Withdrawn:    b.Counts.Withdrawn,
			ReIdentified: b.Counts.ReIdentified,
			Paired:       b.Counts.Paired,
		},
		Balance:     ImportBalance{Status: ImportBalanceStatus(b.Balance.Status)},
		StartedAt:   b.StartedAt,
		CompletedAt: b.CompletedAt,
	}
	if b.ReadEmpty {
		out.ReadEmpty = &b.ReadEmpty
	}

	if b.SyncID != uuid.Nil {
		out.SyncId = &b.SyncID
	}

	if b.PeriodFrom != nil {
		out.PeriodFrom = &openapi_types.Date{Time: *b.PeriodFrom}
		out.PeriodTo = &openapi_types.Date{Time: *b.PeriodTo}
	}

	if b.Balance.Date != nil {
		out.Balance.Date = &openapi_types.Date{Time: *b.Balance.Date}
		out.Balance.Amount = &Money{Amount: b.Balance.Amount, Currency: b.Currency}
	}

	if b.Balance.Reason != "" {
		out.Balance.Reason = &b.Balance.Reason
	}

	return out
}

func (s *Server) listImportBatches(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (ImportBatchList, error) {
	params, err := httpserver.Query[ListImportBatchesParams](r)
	if err != nil {
		return ImportBatchList{}, err
	}

	p, err := listPage[app.BatchKey](params.Limit, params.Cursor)
	if err != nil {
		return ImportBatchList{}, err
	}

	batches, next, err := s.svc.ListBatches(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return ImportBatchList{}, err
	}

	out := ImportBatchList{Items: make([]ImportBatch, len(batches))}
	for i, b := range batches {
		out.Items[i] = toBatchAPI(b)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}
