package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

func (s *Server) listRules(ctx context.Context, r *http.Request, _ httpserver.None) (RulePage, error) {
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

// createRule is a custom handler: the success status is 201 with a Location header.
func (s *Server) createRule(w http.ResponseWriter, r *http.Request) {
	var body CreateRuleJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	rule, err := fromRuleInput(body)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	created, err := s.svc.CreateRule(r.Context(), auth.MustBooksID(r.Context()), rule)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	s.writeCreated(w, r, BaseURL+"/rules/"+created.ID.String(), toRuleAPI(created))
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

func toAliasAPI(a domain.Alias) PayeeAlias {
	return PayeeAlias{Id: a.ID, Pattern: a.Pattern, MatchType: PayeeAliasMatchType(a.MatchType), PayeeId: a.PayeeID}
}

func fromAliasInput(in PayeeAliasInput) domain.Alias {
	return domain.Alias{Pattern: in.Pattern, MatchType: domain.MatchType(in.MatchType), PayeeID: in.PayeeId}
}

func (s *Server) listPayeeAliases(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (PayeeAliasPage, error) {
	params, err := httpserver.Query[ListPayeeAliasesParams](r)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	p, err := listPage[app.AliasKey](params.Limit, params.Cursor)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	aliases, next, err := s.svc.ListAliases(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	out := PayeeAliasPage{Items: make([]PayeeAlias, len(aliases))}
	for i, a := range aliases {
		out.Items[i] = toAliasAPI(a)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

// createPayeeAlias is a custom handler: the success status is 201 with a Location header.
func (s *Server) createPayeeAlias(w http.ResponseWriter, r *http.Request) {
	var body CreatePayeeAliasJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	a, err := s.svc.CreateAlias(r.Context(), auth.MustBooksID(r.Context()), fromAliasInput(body))
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	s.writeCreated(w, r, BaseURL+"/payee-aliases/"+a.ID.String(), toAliasAPI(a))
}

func (s *Server) getPayeeAlias(ctx context.Context, r *http.Request, _ httpserver.None) (PayeeAlias, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return PayeeAlias{}, err
	}

	a, err := s.svc.Alias(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return PayeeAlias{}, err
	}

	return toAliasAPI(a), nil
}

func (s *Server) changePayeeAlias(
	ctx context.Context, r *http.Request, body ChangePayeeAliasJSONRequestBody,
) (PayeeAlias, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return PayeeAlias{}, err
	}

	in := fromAliasInput(body)
	in.ID = id

	a, err := s.svc.ChangeAlias(ctx, auth.MustBooksID(ctx), in)
	if err != nil {
		return PayeeAlias{}, err
	}

	return toAliasAPI(a), nil
}

func (s *Server) deletePayeeAlias(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteAlias(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

// writeCreated answers 201 with the JSON body and the Location header of the created record
// (ADR 007, C6).
func (s *Server) writeCreated(w http.ResponseWriter, r *http.Request, location string, body any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Location", location)
	w.WriteHeader(http.StatusCreated)
	_, _ = buf.WriteTo(w)
}
