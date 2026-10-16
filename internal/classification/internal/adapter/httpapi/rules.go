package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// location is the Location header of a created record (ADR 007, C6).
func location(collection string, id uuid.UUID) *string {
	l := BaseURL + collection + id.String()
	return &l
}

func toRuleAPI(r domain.Rule) Rule {
	out := Rule{
		Id: r.ID, Name: r.Name, Priority: r.Priority, Enabled: r.Enabled, StopProcessing: r.StopProcessing,
		Conditions: make([]RuleCondition, len(r.Conditions)), Actions: make([]RuleAction, len(r.Actions)),
	}
	for i, c := range r.Conditions {
		d := c.Doc()
		out.Conditions[i] = RuleCondition{Field: RuleConditionField(d.Field), Operator: RuleConditionOperator(d.Operator), Value: d.Value}
	}
	for i, a := range r.Actions {
		out.Actions[i] = toActionAPI(a.Doc())
	}
	return out
}

func toActionAPI(d domain.ActionDoc) RuleAction {
	out := RuleAction{Type: RuleActionType(d.Type)}
	if d.CategoryID != uuid.Nil {
		out.CategoryId = &d.CategoryID
	}
	if d.PayeeID != uuid.Nil {
		out.PayeeId = &d.PayeeID
	}
	if d.AccountID != uuid.Nil {
		out.AccountId = &d.AccountID
	}
	if d.Tags != nil {
		out.Tags = &d.Tags
	}
	if d.Parts != nil {
		parts := make([]RuleSplitPart, len(d.Parts))
		for i, p := range d.Parts {
			parts[i] = RuleSplitPart{CategoryId: p.CategoryID}
			if p.Percent != 0 {
				parts[i].Percent = &p.Percent
			}
			if p.Amount != nil {
				parts[i].Amount = &Money{Amount: p.Amount.Amount, Currency: p.Amount.Currency}
			}
			if p.Remainder {
				parts[i].Remainder = &p.Remainder
			}
		}
		out.Parts = &parts
	}
	return out
}

func fromRuleInput(in RuleInput) (domain.Rule, error) {
	r := domain.Rule{Name: in.Name, Enabled: in.Enabled == nil || *in.Enabled, StopProcessing: in.StopProcessing != nil && *in.StopProcessing}
	conditions := make([]domain.ConditionDoc, len(in.Conditions))
	for i, c := range in.Conditions {
		conditions[i] = domain.ConditionDoc{Field: string(c.Field), Operator: string(c.Operator), Value: c.Value}
	}
	actions := make([]domain.ActionDoc, len(in.Actions))
	for i, a := range in.Actions {
		d := domain.ActionDoc{Type: string(a.Type)}
		if a.CategoryId != nil {
			d.CategoryID = *a.CategoryId
		}
		if a.PayeeId != nil {
			d.PayeeID = *a.PayeeId
		}
		if a.AccountId != nil {
			d.AccountID = *a.AccountId
		}
		if a.Tags != nil {
			d.Tags = *a.Tags
		}
		if a.Parts != nil {
			for _, p := range *a.Parts {
				pd := domain.PartDoc{CategoryID: p.CategoryId, Remainder: p.Remainder != nil && *p.Remainder}
				if p.Percent != nil {
					pd.Percent = *p.Percent
				}
				if p.Amount != nil {
					pd.Amount = &domain.MoneyDoc{Amount: p.Amount.Amount, Currency: p.Amount.Currency}
				}
				d.Parts = append(d.Parts, pd)
			}
		}
		actions[i] = d
	}
	return domain.RuleFromDocs(r, conditions, actions)
}

func (s *Server) ListRules(ctx context.Context, req ListRulesRequestObject) (ListRulesResponseObject, error) {
	p, err := listPage[app.RuleKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	rules, next, err := s.svc.ListRules(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListRules200JSONResponse{Items: make([]Rule, len(rules))}
	for i, r := range rules {
		out.Items[i] = toRuleAPI(r)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) CreateRule(ctx context.Context, req CreateRuleRequestObject) (CreateRuleResponseObject, error) {
	r, err := fromRuleInput(*req.Body)
	if err != nil {
		return nil, err
	}
	created, err := s.svc.CreateRule(ctx, auth.MustUserID(ctx), r)
	if err != nil {
		return nil, err
	}
	return CreateRule201JSONResponse{Body: toRuleAPI(created), Headers: CreateRule201ResponseHeaders{Location: location("/rules/", created.ID)}}, nil
}

func (s *Server) GetRule(ctx context.Context, req GetRuleRequestObject) (GetRuleResponseObject, error) {
	r, err := s.svc.Rule(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetRule200JSONResponse(toRuleAPI(r)), nil
}

func (s *Server) ChangeRule(ctx context.Context, req ChangeRuleRequestObject) (ChangeRuleResponseObject, error) {
	r, err := fromRuleInput(*req.Body)
	if err != nil {
		return nil, err
	}
	r.ID = req.Id
	changed, err := s.svc.ChangeRule(ctx, auth.MustUserID(ctx), r)
	if err != nil {
		return nil, err
	}
	return ChangeRule200JSONResponse(toRuleAPI(changed)), nil
}

func (s *Server) DeleteRule(ctx context.Context, req DeleteRuleRequestObject) (DeleteRuleResponseObject, error) {
	if err := s.svc.DeleteRule(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteRule204Response{}, nil
}

func (s *Server) ReorderRules(ctx context.Context, req ReorderRulesRequestObject) (ReorderRulesResponseObject, error) {
	rules, err := s.svc.ReorderRules(ctx, auth.MustUserID(ctx), req.Body.RuleIds)
	if err != nil {
		return nil, err
	}
	out := ReorderRules200JSONResponse{Items: make([]Rule, len(rules))}
	for i, r := range rules {
		out.Items[i] = toRuleAPI(r)
	}
	return out, nil
}

func toAliasAPI(a domain.Alias) PayeeAlias {
	return PayeeAlias{Id: a.ID, Pattern: a.Pattern, MatchType: PayeeAliasMatchType(a.MatchType), PayeeId: a.PayeeID}
}

func fromAliasInput(in PayeeAliasInput) domain.Alias {
	return domain.Alias{Pattern: in.Pattern, MatchType: domain.MatchType(in.MatchType), PayeeID: in.PayeeId}
}

func (s *Server) ListPayeeAliases(ctx context.Context, req ListPayeeAliasesRequestObject) (ListPayeeAliasesResponseObject, error) {
	p, err := listPage[app.AliasKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	aliases, next, err := s.svc.ListAliases(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListPayeeAliases200JSONResponse{Items: make([]PayeeAlias, len(aliases))}
	for i, a := range aliases {
		out.Items[i] = toAliasAPI(a)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) CreatePayeeAlias(ctx context.Context, req CreatePayeeAliasRequestObject) (CreatePayeeAliasResponseObject, error) {
	a, err := s.svc.CreateAlias(ctx, auth.MustUserID(ctx), fromAliasInput(*req.Body))
	if err != nil {
		return nil, err
	}
	return CreatePayeeAlias201JSONResponse{Body: toAliasAPI(a), Headers: CreatePayeeAlias201ResponseHeaders{Location: location("/payee-aliases/", a.ID)}}, nil
}

func (s *Server) GetPayeeAlias(ctx context.Context, req GetPayeeAliasRequestObject) (GetPayeeAliasResponseObject, error) {
	a, err := s.svc.Alias(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetPayeeAlias200JSONResponse(toAliasAPI(a)), nil
}

func (s *Server) ChangePayeeAlias(ctx context.Context, req ChangePayeeAliasRequestObject) (ChangePayeeAliasResponseObject, error) {
	in := fromAliasInput(*req.Body)
	in.ID = req.Id
	a, err := s.svc.ChangeAlias(ctx, auth.MustUserID(ctx), in)
	if err != nil {
		return nil, err
	}
	return ChangePayeeAlias200JSONResponse(toAliasAPI(a)), nil
}

func (s *Server) DeletePayeeAlias(ctx context.Context, req DeletePayeeAliasRequestObject) (DeletePayeeAliasResponseObject, error) {
	if err := s.svc.DeleteAlias(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeletePayeeAlias204Response{}, nil
}
