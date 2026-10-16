package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toSuggestionAPI(s app.Suggestion) RuleSuggestion {
	out := RuleSuggestion{
		Id: s.ID, State: RuleSuggestionState(s.State), ExampleTransactionIds: s.Examples, CreatedAt: s.CreatedAt, DecidedAt: s.DecidedAt,
		Conditions: make([]RuleCondition, len(s.Conditions)), Actions: make([]RuleAction, len(s.Actions)),
	}
	for i, c := range s.Conditions {
		d := c.Doc()
		out.Conditions[i] = RuleCondition{Field: RuleConditionField(d.Field), Operator: RuleConditionOperator(d.Operator), Value: d.Value}
	}
	for i, a := range s.Actions {
		out.Actions[i] = toActionAPI(a.Doc())
	}
	if s.RuleID != uuid.Nil {
		out.RuleId = &s.RuleID
	}
	return out
}

func (s *Server) ListRuleSuggestions(ctx context.Context, req ListRuleSuggestionsRequestObject) (ListRuleSuggestionsResponseObject, error) {
	p, err := listPage[app.SuggestionKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	state := ""
	if req.Params.State != nil {
		state = string(*req.Params.State)
	}
	items, next, err := s.svc.ListSuggestions(ctx, auth.MustUserID(ctx), state, p)
	if err != nil {
		return nil, err
	}
	out := ListRuleSuggestions200JSONResponse{Items: make([]RuleSuggestion, len(items))}
	for i, sg := range items {
		out.Items[i] = toSuggestionAPI(sg)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) AcceptRuleSuggestion(ctx context.Context, req AcceptRuleSuggestionRequestObject) (AcceptRuleSuggestionResponseObject, error) {
	sg, err := s.svc.AcceptSuggestion(ctx, auth.MustUserID(ctx), req.Id, req.Body.Name)
	if err != nil {
		return nil, err
	}
	return AcceptRuleSuggestion200JSONResponse(toSuggestionAPI(sg)), nil
}

func (s *Server) DismissRuleSuggestion(ctx context.Context, req DismissRuleSuggestionRequestObject) (DismissRuleSuggestionResponseObject, error) {
	sg, err := s.svc.DismissSuggestion(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return DismissRuleSuggestion200JSONResponse(toSuggestionAPI(sg)), nil
}
