package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toRuleAPI(r domain.Rule) Rule {
	out := Rule{
		Id:             r.ID,
		Name:           r.Name,
		Priority:       r.Priority,
		Enabled:        r.Enabled,
		StopProcessing: r.StopProcessing,
		Conditions: make(
			[]RuleCondition,
			len(r.Conditions),
		),
		Actions: make([]RuleAction, len(r.Actions)),
	}
	for i, c := range r.Conditions {
		d := c.Doc()
		out.Conditions[i] = RuleCondition{
			Field:    RuleConditionField(d.Field),
			Operator: RuleConditionOperator(d.Operator),
			Value:    d.Value,
		}
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
	r := domain.Rule{
		Name:           in.Name,
		Enabled:        in.Enabled == nil || *in.Enabled,
		StopProcessing: in.StopProcessing != nil && *in.StopProcessing,
	}

	conditions := make([]domain.ConditionDoc, len(in.Conditions))
	for i, c := range in.Conditions {
		conditions[i] = domain.ConditionDoc{
			Field:    string(c.Field),
			Operator: string(c.Operator),
			Value:    c.Value,
		}
	}

	actions := make([]domain.ActionDoc, len(in.Actions))
	for i, a := range in.Actions {
		actions[i] = fromActionInput(a)
	}

	return domain.RuleFromDocs(r, conditions, actions)
}

func fromActionInput(a RuleAction) domain.ActionDoc {
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
			pd := domain.PartDoc{
				CategoryID: p.CategoryId,
				Remainder:  p.Remainder != nil && *p.Remainder,
			}
			if p.Percent != nil {
				pd.Percent = *p.Percent
			}

			if p.Amount != nil {
				pd.Amount = &domain.MoneyDoc{
					Amount:   p.Amount.Amount,
					Currency: p.Amount.Currency,
				}
			}

			d.Parts = append(d.Parts, pd)
		}
	}

	return d
}

func (s *Server) listRules(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (RulePage, error) {
	params, err := httpserver.Query[ListRulesParams](r)
	if err != nil {
		return RulePage{}, err
	}

	p, err := listPage[app.RuleKey](params.Limit, params.Cursor)
	if err != nil {
		return RulePage{}, err
	}

	rules, next, err := s.svc.ListRules(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return RulePage{}, err
	}

	out := RulePage{Items: make([]Rule, len(rules))}
	for i, rule := range rules {
		out.Items[i] = toRuleAPI(rule)
	}

	if err := s.withUsage(ctx, out.Items); err != nil {
		return RulePage{}, err
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createRule(
	ctx context.Context, _ *http.Request, in CreateRuleJSONRequestBody,
) (Rule, string, error) {
	rule, err := fromRuleInput(in)
	if err != nil {
		return Rule{}, "", err
	}

	created, err := s.svc.CreateRule(ctx, auth.MustBooksID(ctx), rule)
	if err != nil {
		return Rule{}, "", err
	}

	return toRuleAPI(created), BaseURL + "/rules/" + created.ID.String(), nil
}

func (s *Server) previewRule(
	ctx context.Context, _ *http.Request, in PreviewRuleJSONRequestBody,
) (RulePreview, error) {
	rule, err := fromRuleInput(in)
	if err != nil {
		return RulePreview{}, err
	}

	p, err := s.svc.PreviewRule(ctx, auth.MustBooksID(ctx), rule)
	if err != nil {
		return RulePreview{}, err
	}

	set := func(ps app.PreviewSet) RulePreviewSet {
		ids := ps.TransactionIDs
		if ids == nil {
			ids = []uuid.UUID{}
		}

		return RulePreviewSet{Count: ps.Count, TransactionIds: ids}
	}

	return RulePreview{WouldCategorize: set(p.WouldCategorize), Conflicts: set(p.Conflicts)}, nil
}

func (s *Server) getRule(ctx context.Context, r *http.Request, _ httpserver.None) (Rule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Rule{}, err
	}

	rule, err := s.svc.Rule(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Rule{}, err
	}

	out := []Rule{toRuleAPI(rule)}
	if err := s.withUsage(ctx, out); err != nil {
		return Rule{}, err
	}

	return out[0], nil
}

func (s *Server) changeRule(
	ctx context.Context, r *http.Request, in ChangeRuleJSONRequestBody,
) (Rule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Rule{}, err
	}

	rule, err := fromRuleInput(in)
	if err != nil {
		return Rule{}, err
	}

	rule.ID = id

	changed, err := s.svc.ChangeRule(ctx, auth.MustBooksID(ctx), rule)
	if err != nil {
		return Rule{}, err
	}

	out := []Rule{toRuleAPI(changed)}
	if err := s.withUsage(ctx, out); err != nil {
		return Rule{}, err
	}

	return out[0], nil
}

func (s *Server) deleteRule(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteRule(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) reorderRules(
	ctx context.Context, _ *http.Request, in ReorderRulesJSONRequestBody,
) (RuleList, error) {
	rules, err := s.svc.ReorderRules(ctx, auth.MustBooksID(ctx), in.RuleIds)
	if err != nil {
		return RuleList{}, err
	}

	out := RuleList{Items: make([]Rule, len(rules))}
	for i, rule := range rules {
		out.Items[i] = toRuleAPI(rule)
	}

	if err := s.withUsage(ctx, out.Items); err != nil {
		return RuleList{}, err
	}

	return out, nil
}

// withUsage fills the usage of each rule (A80).
func (s *Server) withUsage(ctx context.Context, rules []Rule) error {
	ids := make([]uuid.UUID, len(rules))
	for i, r := range rules {
		ids[i] = r.Id
	}

	usage, err := s.svc.RuleUsage(ctx, auth.MustBooksID(ctx), ids)
	if err != nil {
		return err
	}

	for i := range rules {
		if u, ok := usage[rules[i].Id]; ok {
			last := u.Last
			rules[i].CategorizedCount, rules[i].LastCategorizedAt = u.Count, &last
		}
	}

	return nil
}
