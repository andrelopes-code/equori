package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toSuggestionAPI(s app.Suggestion) RuleSuggestion {
	out := RuleSuggestion{
		Id:                    s.ID,
		State:                 RuleSuggestionState(s.State),
		ExampleTransactionIds: s.Examples,
		CreatedAt:             s.CreatedAt,
		DecidedAt:             s.DecidedAt,
		Conditions: make(
			[]RuleCondition,
			len(s.Conditions),
		),
		Actions: make([]RuleAction, len(s.Actions)),
	}
	for i, c := range s.Conditions {
		d := c.Doc()
		out.Conditions[i] = RuleCondition{
			Field:    RuleConditionField(d.Field),
			Operator: RuleConditionOperator(d.Operator),
			Value:    d.Value,
		}
	}

	for i, a := range s.Actions {
		out.Actions[i] = toActionAPI(a.Doc())
	}

	if s.RuleID != uuid.Nil {
		out.RuleId = &s.RuleID
	}

	return out
}

func (s *Server) listRuleSuggestions(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (RuleSuggestionPage, error) {
	params, err := httpserver.Query[ListRuleSuggestionsParams](r)
	if err != nil {
		return RuleSuggestionPage{}, err
	}

	p, err := listPage[app.SuggestionKey](params.Limit, params.Cursor)
	if err != nil {
		return RuleSuggestionPage{}, err
	}

	state := ""
	if params.State != nil {
		state = string(*params.State)
	}

	items, next, err := s.svc.ListSuggestions(ctx, auth.MustBooksID(ctx), state, p)
	if err != nil {
		return RuleSuggestionPage{}, err
	}

	out := RuleSuggestionPage{Items: make([]RuleSuggestion, len(items))}
	for i, sg := range items {
		out.Items[i] = toSuggestionAPI(sg)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) acceptRuleSuggestion(
	ctx context.Context, r *http.Request, in AcceptRuleSuggestionJSONRequestBody,
) (RuleSuggestion, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return RuleSuggestion{}, err
	}

	sg, err := s.svc.AcceptSuggestion(ctx, auth.MustBooksID(ctx), id, in.Name)
	if err != nil {
		return RuleSuggestion{}, err
	}

	return toSuggestionAPI(sg), nil
}

func (s *Server) dismissRuleSuggestion(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (RuleSuggestion, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return RuleSuggestion{}, err
	}

	sg, err := s.svc.DismissSuggestion(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return RuleSuggestion{}, err
	}

	return toSuggestionAPI(sg), nil
}
