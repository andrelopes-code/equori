package httpapi

import (
	"context"

	"net/http"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getCategorization(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (Categorization, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Categorization{}, err
	}

	rec, err := s.svc.Categorization(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Categorization{}, err
	}

	return toCategorizationAPI(rec), nil
}

func (s *Server) listCategorizations(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (CategorizationList, error) {
	params, err := httpserver.Query[ListCategorizationsParams](r)
	if err != nil {
		return CategorizationList{}, err
	}

	if n := len(params.TransactionId); n == 0 || n > 200 {
		return CategorizationList{}, &paramError{field: "transaction_id", message: "must have 1 to 200 ids"}
	}

	recs, err := s.svc.Categorizations(ctx, auth.MustBooksID(ctx), params.TransactionId)
	if err != nil {
		return CategorizationList{}, err
	}

	out := CategorizationList{Items: make([]Categorization, len(recs))}
	for i, rec := range recs {
		out.Items[i] = toCategorizationAPI(rec)
	}

	return out, nil
}

func toCategorizationAPI(rec app.Record) Categorization {
	out := Categorization{TransactionId: rec.TransactionID, DecidedAt: rec.DecidedAt}
	if rec.Method != "" {
		m := CategorizationMethod(rec.Method)
		out.Method = &m
	}

	if rec.RuleID != uuid.Nil {
		out.RuleId = &rec.RuleID
	}

	return out
}

func (s *Server) runRules(ctx context.Context, _ *http.Request, _ httpserver.None) (RuleRun, error) {
	examined, categorized, err := s.svc.RunRules(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return RuleRun{}, err
	}

	return RuleRun{Examined: examined, Categorized: categorized}, nil
}

func (s *Server) getCategorizationStatistics(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (CategorizationStatistics, error) {
	params, err := httpserver.Query[GetCategorizationStatisticsParams](r)
	if err != nil {
		return CategorizationStatistics{}, err
	}

	if params.To.Before(params.From.Time) {
		return CategorizationStatistics{}, &paramError{field: "to", message: "must not be before from"}
	}

	st, err := s.svc.Statistics(ctx, auth.MustBooksID(ctx), params.From.Time, params.To.Time)
	if err != nil {
		return CategorizationStatistics{}, err
	}

	return CategorizationStatistics{
		From: params.From, To: openapi_types.Date{Time: params.To.Time},
		Total: st.Total, Rule: st.Rule, Source: st.Source, History: st.History, Manual: st.Manual, Uncategorized: st.Uncategorized,
	}, nil
}
