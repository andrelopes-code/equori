package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
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
	PayeeID             string              `json:"payee_id,omitzero" jsonschema:"for create_rule, change_rule: payee to set; for create_alias, change_alias: the alias payee"`
	Pattern             string              `json:"pattern,omitzero" jsonschema:"for create_alias and change_alias: text matched against imported descriptions"`
	MatchType           manageRuleMatchType `json:"match_type,omitzero" jsonschema:"for create_alias and change_alias: how pattern matches"`
	RuleIDs             []string            `json:"rule_ids,omitzero" jsonschema:"for reorder_rules: every rule ID in the new order"`
	Conditions          []string            `json:"conditions,omitzero" jsonschema:"for create_rule, change_rule, with actions, not with description_contains: all must hold; each reads field operator value. Fields: description, raw_description, payee, amount, absolute_amount, account, account_kind, source, weekday, day_of_month, installment. Operators: equals, contains, starts_with, regex, between, greater_than, less_than, in_list. between and in_list join values with a bar between spaces; an amount reads 10.00 BRL"`
	Actions             []string            `json:"actions,omitzero" jsonschema:"for create_rule, change_rule: each reads type target; add_tags takes comma-separated tags, the others an ID"`
	Enabled             tool.OptionalBool   `json:"enabled,omitzero" jsonschema:"for create_rule, change_rule: whether it runs; true on create"`
	StopProcessing      tool.OptionalBool   `json:"stop_processing,omitzero" jsonschema:"for create_rule, change_rule: skip later rules after it"`
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

func (in manageRuleIn) alias(id uuid.UUID, payee uuid.UUID) domain.Alias {
	return domain.Alias{ID: id, Pattern: in.Pattern, MatchType: domain.MatchType(in.MatchType), PayeeID: payee}
}

// notFound is the not-found error the module maps to the not_found code.
func notFound() error { return app.ErrNotFound }

func manageRule(svc *app.Service, names Names, today func(context.Context) time.Time) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_rule",
		Description: "Proposes a change to automatic categorization: create, change, reorder or delete a rule; accept or dismiss a suggested rule; run the rules; map an aggregator's category; create, change or delete a payee alias. " +
			"Use it when the user wants future transactions categorized automatically. " +
			"Do not use it for transactions already recorded one by one: categorize_transactions does. " +
			"The user confirms every change.",
		Effect: tool.Destructive,
	}, previewManageRule(svc, names, today), applyManageRule(svc))
}
