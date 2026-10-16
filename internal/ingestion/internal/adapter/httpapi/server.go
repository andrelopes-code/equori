package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
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
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
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

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) (problem.Details, bool) {
	if pe, ok := errors.AsType[*paramError](err); ok {
		d := problem.New(http.StatusBadRequest, "invalid_request", pe.Error())
		d.Errors = []problem.FieldError{{Field: pe.field, Message: pe.message}}
		return d, true
	}
	if ue, ok := errors.AsType[*app.UnauthorizedError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "provider_unauthorized", ue.Error())
		d.Errors = []problem.FieldError{{Field: ue.Field, Message: "rejected by the provider"}}
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
	case errors.Is(err, app.ErrRecordResolved):
		return problem.New(http.StatusConflict, "record_resolved", err.Error()), true
	case errors.Is(err, app.ErrAlreadyMatched):
		return problem.New(http.StatusConflict, "already_matched", err.Error()), true
	case errors.Is(err, app.ErrIntegrationUnavailable):
		return problem.New(http.StatusConflict, "integration_unavailable", err.Error()), true
	case errors.Is(err, app.ErrIntegrationInUse):
		return problem.New(http.StatusConflict, "integration_in_use", "delete the integration's connections first"), true
	case errors.Is(err, app.ErrProviderUnavailable):
		// The cause stays out of the response: it may name the provider's address.
		return problem.New(http.StatusBadGateway, "provider_unavailable", app.ErrProviderUnavailable.Error()), true
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
		Id: b.ID, AccountId: b.AccountID, Source: ImportBatchSource(b.Source), FileName: ref(b.FileName),
		ExternalAccountId: b.ExternalAccountID,
		Counts: ImportCounts{
			Received: b.Counts.Received, Ignored: b.Counts.Ignored, Matched: b.Counts.Matched,
			Created: b.Counts.Created, NeedsReview: b.Counts.NeedsReview, Discarded: b.Counts.Discarded,
			Updated: b.Counts.Updated, Withdrawn: b.Counts.Withdrawn,
		},
		Balance:   ImportBalance{Status: ImportBalanceStatus(b.Balance.Status)},
		StartedAt: b.StartedAt, CompletedAt: b.CompletedAt,
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

func (s *Server) ListImportBatches(ctx context.Context, req ListImportBatchesRequestObject) (ListImportBatchesResponseObject, error) {
	p, err := listPage[app.BatchKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	batches, next, err := s.svc.ListBatches(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListImportBatches200JSONResponse{Items: make([]ImportBatch, len(batches))}
	for i, b := range batches {
		out.Items[i] = toBatchAPI(b)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}
