package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type listRulesKind string

func (listRulesKind) Values() []string {
	return []string{"rules", "suggestions", "source_categories", "payee_aliases"}
}

type listRulesIn struct {
	Kind   listRulesKind `json:"kind" jsonschema:"what to list"`
	RuleID string        `json:"rule_id,omitzero" jsonschema:"for rules: return only this rule"`
	tool.PageArgs
}

type ruleView struct {
	RuleID           string `json:"rule_id"`
	Name             string `json:"name"`
	Priority         int    `json:"priority"`
	Enabled          bool   `json:"enabled"`
	ConditionsText   string `json:"conditions_text"`
	ActionsText      string `json:"actions_text"`
	CategorizedCount int    `json:"categorized_count"`
}

type suggestionView struct {
	SuggestionID          string   `json:"suggestion_id"`
	ConditionsText        string   `json:"conditions_text"`
	ActionsText           string   `json:"actions_text"`
	ExampleTransactionIDs []string `json:"example_transaction_ids"`
}

type sourceCategoryView struct {
	SourceCategoryID string `json:"source_category_id"`
	Aggregator       string `json:"aggregator"`
	Name             string `json:"name"`
	Count            int    `json:"count"`
	CategoryName     string `json:"category_name,omitzero"`
}

type aliasView struct {
	AliasID   string `json:"alias_id"`
	Pattern   string `json:"pattern"`
	MatchType string `json:"match_type"`
	PayeeName string `json:"payee_name"`
}

type listRulesOut struct {
	Rules            []ruleView           `json:"rules,omitzero"`
	Suggestions      []suggestionView     `json:"suggestions,omitzero"`
	SourceCategories []sourceCategoryView `json:"source_categories,omitzero"`
	PayeeAliases     []aliasView          `json:"payee_aliases,omitzero"`
	NextCursor       string               `json:"next_cursor,omitzero" jsonschema:"present when more items follow; pass it as cursor"`
}

func listRules(svc *app.Service, names Names) tool.Tool {
	return tool.New(tool.Spec{
		Name: "list_rules",
		Description: "Lists categorization rules by priority, rules suggested from the user's repeated corrections, the categories an aggregator assigned to imported lines, or payee aliases. " +
			"Use it to see why transactions get a category automatically or what suggestions are waiting. " +
			"Do not use it for one transaction's categorization: explain_categorization does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, userID int64, in listRulesIn) (listRulesOut, error) {
		if in.RuleID != "" && in.Kind != "rules" {
			return listRulesOut{}, tool.InvalidArgument("rule_id", "is not used by kind "+string(in.Kind))
		}
		ruleID, err := optionalID(in.RuleID, "rule_id")
		if err != nil {
			return listRulesOut{}, err
		}
		categories, payees, err := names(ctx, userID)
		if err != nil {
			return listRulesOut{}, err
		}
		var out listRulesOut
		switch in.Kind {
		case "rules":
			p, err := pageRequest[app.RuleKey](in.PageArgs)
			if err != nil {
				return out, err
			}
			var rules []domain.Rule
			var next *app.RuleKey
			if ruleID != uuid.Nil {
				one, err := svc.Rule(ctx, userID, ruleID)
				if err != nil {
					return out, err
				}
				rules = []domain.Rule{one}
			} else if rules, next, err = svc.ListRules(ctx, userID, p); err != nil {
				return out, err
			}
			ids := make([]uuid.UUID, len(rules))
			for i, r := range rules {
				ids[i] = r.ID
			}
			usage, err := svc.RuleUsage(ctx, userID, ids)
			if err != nil {
				return out, err
			}
			out.Rules = []ruleView{}
			for _, r := range rules {
				out.Rules = append(out.Rules, ruleView{
					RuleID: r.ID.String(), Name: r.Name, Priority: r.Priority, Enabled: r.Enabled,
					ConditionsText: conditionsText(r.Conditions), ActionsText: actionsText(r.Actions, categories, payees), CategorizedCount: usage[r.ID].Count,
				})
			}
			out.NextCursor, err = nextCursor(next)
			return out, err
		case "suggestions":
			p, err := pageRequest[app.SuggestionKey](in.PageArgs)
			if err != nil {
				return out, err
			}
			items, next, err := svc.ListSuggestions(ctx, userID, app.SuggestionPending, p)
			if err != nil {
				return out, err
			}
			out.Suggestions = []suggestionView{}
			for _, s := range items {
				ex := make([]string, len(s.Examples))
				for i, id := range s.Examples {
					ex[i] = id.String()
				}
				out.Suggestions = append(out.Suggestions, suggestionView{
					SuggestionID: s.ID.String(), ConditionsText: conditionsText(s.Conditions), ActionsText: actionsText(s.Actions, categories, payees), ExampleTransactionIDs: ex,
				})
			}
			out.NextCursor, err = nextCursor(next)
			return out, err
		case "source_categories":
			p, err := pageRequest[app.NameKey](in.PageArgs)
			if err != nil {
				return out, err
			}
			items, next, err := svc.ListSourceCategories(ctx, userID, p)
			if err != nil {
				return out, err
			}
			out.SourceCategories = []sourceCategoryView{}
			for _, c := range items {
				out.SourceCategories = append(out.SourceCategories, sourceCategoryView{
					SourceCategoryID: c.ID.String(), Aggregator: c.Aggregator, Name: c.Name, Count: c.Count, CategoryName: categories[c.CategoryID],
				})
			}
			out.NextCursor, err = nextCursor(next)
			return out, err
		}
		p, err := pageRequest[app.AliasKey](in.PageArgs)
		if err != nil {
			return out, err
		}
		items, next, err := svc.ListAliases(ctx, userID, p)
		if err != nil {
			return out, err
		}
		out.PayeeAliases = []aliasView{}
		for _, a := range items {
			out.PayeeAliases = append(out.PayeeAliases, aliasView{AliasID: a.ID.String(), Pattern: a.Pattern, MatchType: string(a.MatchType), PayeeName: payees[a.PayeeID]})
		}
		out.NextCursor, err = nextCursor(next)
		return out, err
	})
}
