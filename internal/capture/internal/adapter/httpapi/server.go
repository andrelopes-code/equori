// Package httpapi serves the capture operations of api/openapi.yaml.
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/capture/internal/app"
	"github.com/andrelopes-code/equori/internal/capture/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
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

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func toProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrTooManySuggestions):
		return problem.New(http.StatusBadRequest, "invalid_request", err.Error()), true
	case errors.Is(err, app.ErrTransactionNotFound):
		return problem.New(http.StatusNotFound, "not_found", err.Error()), true
	case errors.Is(err, app.ErrNotUncategorized):
		d := problem.New(http.StatusUnprocessableEntity, "transaction_not_uncategorized", err.Error())
		d.Errors = []problem.FieldError{{Field: "transaction_ids", Message: err.Error()}}
		return d, true
	case errors.Is(err, app.ErrTooManyLines):
		return problem.New(http.StatusUnprocessableEntity, "too_many_lines", err.Error()), true
	case errors.Is(err, app.ErrDefaultAccount):
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", err.Error())
		d.Errors = []problem.FieldError{{Field: "default_account_id", Message: err.Error()}}
		return d, true
	case errors.Is(err, app.ErrReferenceDate):
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", err.Error())
		d.Errors = []problem.FieldError{{Field: "reference_date", Message: err.Error()}}
		return d, true
	}
	return problem.Details{}, false
}

func (s *Server) PreviewCapture(ctx context.Context, req PreviewCaptureRequestObject) (PreviewCaptureResponseObject, error) {
	var def uuid.UUID
	if req.Body.DefaultAccountId != nil {
		def = *req.Body.DefaultAccountId
	}
	var reference time.Time
	if req.Body.ReferenceDate != nil {
		y, m, d := req.Body.ReferenceDate.Date()
		reference = time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	}
	lines, err := s.svc.Preview(ctx, auth.MustUserID(ctx), req.Body.Text, def, reference)
	if err != nil {
		return nil, err
	}
	out := make([]CaptureLine, len(lines))
	for i, l := range lines {
		out[i] = toLine(l)
	}
	return PreviewCapture200JSONResponse{Lines: out}, nil
}

func toLine(l app.Line) CaptureLine {
	out := CaptureLine{
		Line: l.Number, Text: l.Text, Kind: CaptureLineKind(l.Kind), Date: openapi_types.Date{Time: l.Date},
		Description: l.Description, Tags: l.Tags, Segments: make([]CaptureSegment, len(l.Segments)),
		Issues:    make([]CaptureIssue, len(l.Issues)),
		AccountId: optUUID(l.AccountID), ToAccountId: optUUID(l.ToAccountID), PayeeId: optUUID(l.PayeeID), CategoryId: optUUID(l.CategoryID),
	}
	if out.Tags == nil {
		out.Tags = []string{}
	}
	for i, s := range l.Segments {
		out.Segments[i] = CaptureSegment{Text: s.Text, Role: CaptureSegmentRole(s.Role)}
	}
	if l.Amount != 0 {
		out.Amount = &Money{Amount: l.Amount, Currency: string(l.Currency)}
	}
	if l.AccountSource != "" {
		source := CaptureLineAccountSource(l.AccountSource)
		out.AccountSource = &source
	}
	if l.Installments > 0 {
		out.Installments = &l.Installments
	}
	if l.CategorySource != "" {
		source := CaptureLineCategorySource(l.CategorySource)
		out.CategorySource = &source
	}
	for i, is := range l.Issues {
		out.Issues[i] = CaptureIssue{Code: CaptureIssueCode(is.Code), Field: CaptureIssueField(is.Field), Choices: toChoices(is.Choices, l.Line)}
	}
	return out
}

func toChoices(cs []domain.Choice, l domain.Line) []CaptureChoice {
	out := make([]CaptureChoice, len(cs))
	for i, c := range cs {
		out[i].AccountId = optUUID(c.AccountID)
		if c.Amount != 0 {
			out[i].Amount = &Money{Amount: c.Amount, Currency: string(l.Currency)}
		}
		if c.Describes {
			description := c.Description
			out[i].Description = &description
		}
	}
	return out
}

func optUUID(id uuid.UUID) *openapi_types.UUID {
	if id == uuid.Nil {
		return nil
	}
	return &id
}

func (s *Server) SuggestCaptureCategories(ctx context.Context, req SuggestCaptureCategoriesRequestObject) (SuggestCaptureCategoriesResponseObject, error) {
	items := make([]app.SuggestItem, len(req.Body.Items))
	for i, it := range req.Body.Items {
		items[i] = app.SuggestItem{Description: it.Description, Class: string(it.Kind)}
	}
	suggestions, available, err := s.svc.Suggest(ctx, auth.MustUserID(ctx), items)
	if err != nil {
		return nil, err
	}
	out := SuggestCaptureCategories200JSONResponse{Available: available, Items: make([]CaptureSuggestion, len(suggestions))}
	for i, sg := range suggestions {
		if sg.CategoryID == uuid.Nil {
			continue
		}
		source := CaptureSuggestionSourceKept
		if sg.FromModel {
			source = CaptureSuggestionSourceModel
		}
		out.Items[i] = CaptureSuggestion{CategoryId: optUUID(sg.CategoryID), Source: &source}
	}
	return out, nil
}

func (s *Server) SuggestTransactionCategories(ctx context.Context, req SuggestTransactionCategoriesRequestObject) (SuggestTransactionCategoriesResponseObject, error) {
	suggestions, available, err := s.svc.SuggestForTransactions(ctx, auth.MustUserID(ctx), req.Body.TransactionIds)
	if err != nil {
		return nil, err
	}
	out := SuggestTransactionCategories200JSONResponse{Available: available, Items: make([]TransactionSuggestion, len(suggestions))}
	for i, sg := range suggestions {
		out.Items[i].TransactionId = req.Body.TransactionIds[i]
		if sg.CategoryID == uuid.Nil {
			continue
		}
		source := TransactionSuggestionSourceKept
		if sg.FromModel {
			source = TransactionSuggestionSourceModel
		}
		out.Items[i].CategoryId, out.Items[i].Source = optUUID(sg.CategoryID), &source
	}
	return out, nil
}
