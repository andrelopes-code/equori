package toolapi

import (
	"slices"

	"github.com/google/uuid"
)

type ids struct {
	rule, suggestion, source, alias, category, payee uuid.UUID
	rules                                            []uuid.UUID
}

func parseManage(in manageRuleIn) (ids, error) {
	fields := manageFields(in)
	needed := neededFields(in, fields)

	if err := required(string(in.Action), fields, needed...); err != nil {
		return ids{}, err
	}

	if in.Action == "create_rule" || in.Action == "change_rule" {
		if err := checkRuleForm(in); err != nil {
			return ids{}, err
		}
	}

	return parseIDs(in)
}

// manageFields marks which arguments the call gave.
func manageFields(in manageRuleIn) []field {
	return []field{
		{
			"rule_id",
			in.RuleID != "",
		},
		{"suggestion_id", in.SuggestionID != ""},
		{"source_category_id", in.SourceCategoryID != ""},
		{
			"alias_id",
			in.AliasID != "",
		},
		{"name", in.Name != ""},
		{"description_contains", in.DescriptionContains != ""},
		{
			"category_id",
			in.CategoryID != "",
		},
		{"payee_id", in.PayeeID != ""},
		{"pattern", in.Pattern != ""},
		{"match_type", in.MatchType != ""},
		{"rule_ids", len(in.RuleIDs) > 0},
		{"conditions", len(in.Conditions) > 0},
		{"actions", len(in.Actions) > 0},
		{"enabled", in.Enabled.Set},
		{"stop_processing", in.StopProcessing.Set},
	}
}

// neededFields lists the arguments the action accepts.
func neededFields(in manageRuleIn, fields []field) []string {
	needed := map[manageRuleAction][]string{
		"create_rule": {"name"}, "change_rule": {"rule_id"},
		"delete_rule": {"rule_id"}, "reorder_rules": {"rule_ids"}, "accept_suggestion": {"suggestion_id", "name"},
		"dismiss_suggestion": {"suggestion_id"}, "run_rules": nil, "map_source_category": {"source_category_id", "category_id"},
		"create_alias": {"pattern", "match_type", "payee_id"}, "change_alias": {"alias_id", "pattern", "match_type", "payee_id"}, "delete_alias": {"alias_id"},
	}[in.Action]
	if in.Action == "create_rule" || in.Action == "change_rule" {
		needed = slices.Clone(needed)
		for _, f := range fields {
			if f.given && !slices.Contains(needed, f.name) && slices.Contains(ruleFields, f.name) {
				needed = append(needed, f.name)
			}
		}
	}

	return needed
}

// parseIDs parses the identifier arguments.
func parseIDs(in manageRuleIn) (ids, error) {
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
