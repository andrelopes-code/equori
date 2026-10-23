package toolapi

import (
	"bytes"
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageRuleAction string

func (manageRuleAction) Values() []string {
	return []string{"create_rule", "change_rule", "delete_rule", "reorder_rules", "accept_suggestion", "dismiss_suggestion", "run_rules", "map_source_category", "create_alias", "change_alias", "delete_alias"}
}

type manageRuleMatchType string

func (manageRuleMatchType) Values() []string { return []string{"equals", "starts_with", "contains"} }

type manageRuleIn struct {
	Action              manageRuleAction    `json:"action" jsonschema:"operation to propose"`
	RuleID              string              `json:"rule_id,omitzero" jsonschema:"for change_rule and delete_rule: rule from list_rules"`
	SuggestionID        string              `json:"suggestion_id,omitzero" jsonschema:"for accept_suggestion and dismiss_suggestion: suggestion from list_rules"`
	SourceCategoryID    string              `json:"source_category_id,omitzero" jsonschema:"for map_source_category: source category from list_rules"`
	AliasID             string              `json:"alias_id,omitzero" jsonschema:"for change_alias and delete_alias: alias from list_rules"`
	Name                string              `json:"name,omitzero" jsonschema:"for create_rule, change_rule and accept_suggestion: rule name"`
	DescriptionContains string              `json:"description_contains,omitzero" jsonschema:"for create_rule and change_rule: text the description must contain"`
	CategoryID          string              `json:"category_id,omitzero" jsonschema:"for create_rule, change_rule and map_source_category: category to set"`
	PayeeID             string              `json:"payee_id,omitzero" jsonschema:"for create_rule and change_rule: payee to set; for create_alias and change_alias: payee the alias names"`
	Pattern             string              `json:"pattern,omitzero" jsonschema:"for create_alias and change_alias: text matched against imported descriptions"`
	MatchType           manageRuleMatchType `json:"match_type,omitzero" jsonschema:"for create_alias and change_alias: how pattern matches"`
	RuleIDs             []string            `json:"rule_ids,omitzero" jsonschema:"for reorder_rules: every rule ID in the new priority order"`
}

type manageRuleOut struct {
	RuleID           string `json:"rule_id,omitzero"`
	SuggestionID     string `json:"suggestion_id,omitzero"`
	SourceCategoryID string `json:"source_category_id,omitzero"`
	AliasID          string `json:"alias_id,omitzero"`
	Examined         int    `json:"examined,omitzero"`
	Categorized      int    `json:"categorized,omitzero"`
	Deleted          bool   `json:"deleted,omitzero"`
}

// ids holds the parsed identifiers of a manage_rule call.
type ids struct {
	rule, suggestion, source, alias, category, payee uuid.UUID
	rules                                            []uuid.UUID
}

func parseManage(in manageRuleIn) (ids, error) {
	fields := []field{
		{"rule_id", in.RuleID != ""}, {"suggestion_id", in.SuggestionID != ""}, {"source_category_id", in.SourceCategoryID != ""},
		{"alias_id", in.AliasID != ""}, {"name", in.Name != ""}, {"description_contains", in.DescriptionContains != ""},
		{"category_id", in.CategoryID != ""}, {"payee_id", in.PayeeID != ""}, {"pattern", in.Pattern != ""},
		{"match_type", in.MatchType != ""}, {"rule_ids", len(in.RuleIDs) > 0},
	}
	needed := map[manageRuleAction][]string{
		"create_rule": {"name", "description_contains", "category_id"}, "change_rule": {"rule_id", "name", "description_contains", "category_id"},
		"delete_rule": {"rule_id"}, "reorder_rules": {"rule_ids"}, "accept_suggestion": {"suggestion_id", "name"},
		"dismiss_suggestion": {"suggestion_id"}, "run_rules": nil, "map_source_category": {"source_category_id", "category_id"},
		"create_alias": {"pattern", "match_type", "payee_id"}, "change_alias": {"alias_id", "pattern", "match_type", "payee_id"}, "delete_alias": {"alias_id"},
	}[in.Action]
	if (in.Action == "create_rule" || in.Action == "change_rule") && in.PayeeID != "" {
		needed = append(slices.Clone(needed), "payee_id")
	}
	if err := required(string(in.Action), fields, needed...); err != nil {
		return ids{}, err
	}
	var p ids
	var err error
	for _, x := range []struct {
		s, field string
		into     *uuid.UUID
	}{
		{in.RuleID, "rule_id", &p.rule}, {in.SuggestionID, "suggestion_id", &p.suggestion}, {in.SourceCategoryID, "source_category_id", &p.source},
		{in.AliasID, "alias_id", &p.alias}, {in.CategoryID, "category_id", &p.category}, {in.PayeeID, "payee_id", &p.payee},
	} {
		if *x.into, err = optionalID(x.s, x.field); err != nil {
			return ids{}, err
		}
	}
	for _, s := range in.RuleIDs {
		id, err := optionalID(s, "rule_ids")
		if err != nil {
			return ids{}, err
		}
		p.rules = append(p.rules, id)
	}
	return p, nil
}

func (in manageRuleIn) alias(id uuid.UUID, payee uuid.UUID) domain.Alias {
	return domain.Alias{ID: id, Pattern: in.Pattern, MatchType: domain.MatchType(in.MatchType), PayeeID: payee}
}

// notFound is the not-found error the module maps to the not_found code.
func notFound() error { return app.ErrNotFound }

func manageRule(svc *app.Service, names Names, today func() time.Time) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_rule",
		Description: "Proposes a change to automatic categorization: create, change, reorder or delete a rule; accept or dismiss a suggested rule; run the rules over uncategorized transactions; map an aggregator's category; create, change or delete a payee alias. " +
			"Use it when the user wants future transactions categorized automatically. " +
			"Do not use it for transactions already recorded one by one: categorize_transactions does. " +
			"The user confirms every change.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, userID int64, in manageRuleIn) (tool.Preview, error) {
		p, err := parseManage(in)
		if err != nil {
			return tool.Preview{}, err
		}
		categories, payees, err := names(ctx, userID)
		if err != nil {
			return tool.Preview{}, err
		}
		pv := tool.Preview{Action: "manage_rule." + string(in.Action)}
		text := tool.TextValue
		switch in.Action {
		case "create_rule", "change_rule":
			rule, err := descriptionRule(in.Name, in.DescriptionContains, p.category, p.payee)
			if err != nil {
				return pv, err
			}
			rule.ID = p.rule
			change := []tool.Change{{Field: "name", After: text(in.Name)}, {Field: "pattern", After: text(in.DescriptionContains)}, {Field: "category", After: text(categories[p.category])}}
			if p.payee != uuid.Nil {
				change = append(change, tool.Change{Field: "payee", After: text(payees[p.payee])})
			}
			pv.Target = "Rule " + in.Name
			if in.Action == "change_rule" {
				old, err := svc.Rule(ctx, userID, p.rule)
				if err != nil {
					return pv, err
				}
				rule.Enabled, rule.StopProcessing, rule.Priority = old.Enabled, old.StopProcessing, old.Priority
				change[0].Before, change[1].Before, change[2].Before = text(old.Name), text(conditionsText(old.Conditions)), text(actionsText(old.Actions, categories, payees))
			}
			preview, err := svc.PreviewRule(ctx, userID, rule)
			if err != nil {
				return pv, err
			}
			pv.Changes = append(change, tool.Change{Field: "count", After: text(fmt.Sprintf("%d transactions of the last year", preview.WouldCategorize.Count))})
		case "delete_rule":
			old, err := svc.Rule(ctx, userID, p.rule)
			if err != nil {
				return pv, err
			}
			pv.Target, pv.Destructive = "Rule "+old.Name, true
			pv.Changes = []tool.Change{{Field: "rule", Before: text(old.Name)}}
		case "reorder_rules":
			rules, err := allRules(ctx, svc, userID)
			if err != nil {
				return pv, err
			}
			current := make([]uuid.UUID, len(rules))
			byID := map[uuid.UUID]domain.Rule{}
			for i, r := range rules {
				current[i], byID[r.ID] = r.ID, r
			}
			sorted := slices.Clone(p.rules)
			slices.SortFunc(sorted, compareIDs)
			slices.SortFunc(current, compareIDs)
			if !slices.Equal(sorted, current) {
				return pv, &domain.FieldError{Field: "rule_ids", Message: "must list every rule exactly once", Err: domain.ErrValidation}
			}
			pv.Target = "Rule order"
			for i, id := range p.rules {
				if r := byID[id]; r.Priority != i+1 {
					pv.Changes = append(pv.Changes, tool.Change{Field: "priority", Before: text(fmt.Sprintf("%s: %d", r.Name, r.Priority)), After: text(fmt.Sprintf("%s: %d", r.Name, i+1))})
				}
			}
		case "accept_suggestion", "dismiss_suggestion":
			s, err := findSuggestion(ctx, svc, userID, p.suggestion)
			if err != nil {
				return pv, err
			}
			if s.State != app.SuggestionPending {
				return pv, app.ErrSuggestionClosed
			}
			pv.Target = "Suggested rule " + conditionsText(s.Conditions)
			if in.Action == "dismiss_suggestion" {
				pv.Changes = []tool.Change{{Field: "status", Before: text(s.State), After: text(app.SuggestionDismissed)}}
				break
			}
			pv.Changes = []tool.Change{
				{Field: "rule", After: text(in.Name)}, {Field: "pattern", After: text(conditionsText(s.Conditions))},
				{Field: "category", After: text(actionsText(s.Actions, categories, payees))},
			}
		case "run_rules":
			st, err := svc.Statistics(ctx, userID, time.Time{}, today())
			if err != nil {
				return pv, err
			}
			pv.Target = "Categorization rules"
			pv.Changes = []tool.Change{{Field: "count", After: text(fmt.Sprintf("%d uncategorized transactions", st.Uncategorized))}}
		case "map_source_category":
			sc, err := findSourceCategory(ctx, svc, userID, p.source)
			if err != nil {
				return pv, err
			}
			if _, ok := categories[p.category]; !ok {
				return pv, &domain.FieldError{Field: "category_id", Message: "unknown category", Err: domain.ErrValidation}
			}
			pv.Target = "Source category " + sc.Name
			pv.Changes = []tool.Change{{Field: "category", Before: text(categories[sc.CategoryID]), After: text(categories[p.category])}}
		case "create_alias", "change_alias", "delete_alias":
			var old domain.Alias
			if in.Action != "create_alias" {
				if old, err = svc.Alias(ctx, userID, p.alias); err != nil {
					return pv, err
				}
			}
			if in.Action == "delete_alias" {
				pv.Target, pv.Destructive = "Alias "+old.Pattern, true
				pv.Changes = []tool.Change{{Field: "pattern", Before: text(old.Pattern)}, {Field: "payee", Before: text(payees[old.PayeeID])}}
				break
			}
			if _, err := domain.NewAlias(in.alias(p.alias, p.payee)); err != nil {
				return pv, err
			}
			if _, ok := payees[p.payee]; !ok {
				return pv, &domain.FieldError{Field: "payee_id", Message: "unknown payee", Err: domain.ErrValidation}
			}
			pv.Target = "Alias " + in.Pattern
			pv.Changes = []tool.Change{{Field: "pattern", After: text(in.Pattern)}, {Field: "kind", After: text(string(in.MatchType))}, {Field: "payee", After: text(payees[p.payee])}}
			if in.Action == "change_alias" {
				pv.Changes[0].Before, pv.Changes[1].Before, pv.Changes[2].Before = text(old.Pattern), text(string(old.MatchType)), text(payees[old.PayeeID])
			}
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in manageRuleIn) (manageRuleOut, error) {
		p, err := parseManage(in)
		if err != nil {
			return manageRuleOut{}, err
		}
		switch in.Action {
		case "create_rule", "change_rule":
			rule, err := descriptionRule(in.Name, in.DescriptionContains, p.category, p.payee)
			if err != nil {
				return manageRuleOut{}, err
			}
			if in.Action == "create_rule" {
				rule, err = svc.CreateRule(ctx, userID, rule)
			} else {
				old, oldErr := svc.Rule(ctx, userID, p.rule)
				if oldErr != nil {
					return manageRuleOut{}, oldErr
				}
				rule.ID, rule.Enabled, rule.StopProcessing = p.rule, old.Enabled, old.StopProcessing
				rule, err = svc.ChangeRule(ctx, userID, rule)
			}
			return manageRuleOut{RuleID: rule.ID.String()}, err
		case "delete_rule":
			return manageRuleOut{Deleted: true}, svc.DeleteRule(ctx, userID, p.rule)
		case "reorder_rules":
			_, err := svc.ReorderRules(ctx, userID, p.rules)
			return manageRuleOut{}, err
		case "accept_suggestion":
			s, err := svc.AcceptSuggestion(ctx, userID, p.suggestion, in.Name)
			return manageRuleOut{SuggestionID: s.ID.String(), RuleID: s.RuleID.String()}, err
		case "dismiss_suggestion":
			s, err := svc.DismissSuggestion(ctx, userID, p.suggestion)
			return manageRuleOut{SuggestionID: s.ID.String()}, err
		case "run_rules":
			examined, categorized, err := svc.RunRules(ctx, userID)
			return manageRuleOut{Examined: examined, Categorized: categorized}, err
		case "map_source_category":
			sc, err := svc.MapSourceCategory(ctx, userID, p.source, p.category)
			return manageRuleOut{SourceCategoryID: sc.ID.String()}, err
		case "create_alias":
			a, err := svc.CreateAlias(ctx, userID, in.alias(uuid.Nil, p.payee))
			return manageRuleOut{AliasID: a.ID.String()}, err
		case "change_alias":
			a, err := svc.ChangeAlias(ctx, userID, in.alias(p.alias, p.payee))
			return manageRuleOut{AliasID: a.ID.String()}, err
		}
		return manageRuleOut{Deleted: true}, svc.DeleteAlias(ctx, userID, p.alias)
	})
}

func findSuggestion(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (app.Suggestion, error) {
	r := page.Request[app.SuggestionKey]{Limit: page.MaxLimit}
	for {
		items, next, err := svc.ListSuggestions(ctx, userID, "", r)
		if err != nil {
			return app.Suggestion{}, err
		}
		if i := slices.IndexFunc(items, func(s app.Suggestion) bool { return s.ID == id }); i >= 0 {
			return items[i], nil
		}
		if next == nil {
			return app.Suggestion{}, notFound()
		}
		r.After = next
	}
}

func findSourceCategory(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (app.SourceCategory, error) {
	r := page.Request[app.NameKey]{Limit: page.MaxLimit}
	for {
		items, next, err := svc.ListSourceCategories(ctx, userID, r)
		if err != nil {
			return app.SourceCategory{}, err
		}
		if i := slices.IndexFunc(items, func(c app.SourceCategory) bool { return c.ID == id }); i >= 0 {
			return items[i], nil
		}
		if next == nil {
			return app.SourceCategory{}, notFound()
		}
		r.After = next
	}
}

func compareIDs(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) }
