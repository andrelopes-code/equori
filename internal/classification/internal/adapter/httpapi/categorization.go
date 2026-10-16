package httpapi

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetCategorization(ctx context.Context, req GetCategorizationRequestObject) (GetCategorizationResponseObject, error) {
	rec, err := s.svc.Categorization(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := GetCategorization200JSONResponse{TransactionId: rec.TransactionID, DecidedAt: rec.DecidedAt}
	if rec.Method != "" {
		m := CategorizationMethod(rec.Method)
		out.Method = &m
	}
	if rec.RuleID != uuid.Nil {
		out.RuleId = &rec.RuleID
	}
	return out, nil
}

func (s *Server) RunRules(ctx context.Context, _ RunRulesRequestObject) (RunRulesResponseObject, error) {
	examined, categorized, err := s.svc.RunRules(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	return RunRules200JSONResponse{Examined: examined, Categorized: categorized}, nil
}

func (s *Server) GetCategorizationStatistics(ctx context.Context, req GetCategorizationStatisticsRequestObject) (GetCategorizationStatisticsResponseObject, error) {
	if req.Params.To.Before(req.Params.From.Time) {
		return nil, &paramError{field: "to", message: "must not be before from"}
	}
	st, err := s.svc.Statistics(ctx, auth.MustUserID(ctx), req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	return GetCategorizationStatistics200JSONResponse{
		From: req.Params.From, To: openapi_types.Date{Time: req.Params.To.Time},
		Total: st.Total, Rule: st.Rule, Source: st.Source, History: st.History, Manual: st.Manual, Uncategorized: st.Uncategorized,
	}, nil
}
