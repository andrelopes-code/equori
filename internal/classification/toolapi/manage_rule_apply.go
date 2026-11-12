package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
)

// applyManageRule returns the apply handler of manage_rule.
func applyManageRule(
	svc *app.Service,
) func(context.Context, int64, manageRuleIn) (manageRuleOut, error) {
	return func(ctx context.Context, booksID int64, in manageRuleIn) (manageRuleOut, error) {
		p, err := parseManage(in)
		if err != nil {
			return manageRuleOut{}, err
		}

		switch in.Action {
		case "create_rule", "change_rule":
			return applyRule(ctx, svc, booksID, in, p)
		case "delete_rule":
			return manageRuleOut{Deleted: true}, svc.DeleteRule(ctx, booksID, p.rule)
		case "reorder_rules":
			_, err := svc.ReorderRules(ctx, booksID, p.rules)
			return manageRuleOut{}, err
		case "accept_suggestion":
			s, err := svc.AcceptSuggestion(ctx, booksID, p.suggestion, in.Name)
			return manageRuleOut{SuggestionID: s.ID.String(), RuleID: s.RuleID.String()}, err
		case "dismiss_suggestion":
			s, err := svc.DismissSuggestion(ctx, booksID, p.suggestion)
			return manageRuleOut{SuggestionID: s.ID.String()}, err
		case "run_rules":
			examined, categorized, err := svc.RunRules(ctx, booksID)
			return manageRuleOut{Examined: examined, Categorized: categorized}, err
		case "map_source_category":
			sc, err := svc.MapSourceCategory(ctx, booksID, p.source, p.category)
			return manageRuleOut{SourceCategoryID: sc.ID.String()}, err
		case "create_alias":
			a, err := svc.CreateAlias(ctx, booksID, in.alias(uuid.Nil, p.payee))
			return manageRuleOut{AliasID: a.ID.String()}, err
		case "change_alias":
			a, err := svc.ChangeAlias(ctx, booksID, in.alias(p.alias, p.payee))
			return manageRuleOut{AliasID: a.ID.String()}, err
		}

		return manageRuleOut{Deleted: true}, svc.DeleteAlias(ctx, booksID, p.alias)
	}
}

// applyRule creates or changes the rule that in describes.
func applyRule(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageRuleIn,
	p ids,
) (manageRuleOut, error) {
	var err error

	var old domain.Rule
	if in.Action == "change_rule" {
		if old, err = svc.Rule(ctx, booksID, p.rule); err != nil {
			return manageRuleOut{}, err
		}
	}

	rule, err := buildRule(in, p, old)
	if err != nil {
		return manageRuleOut{}, err
	}

	if in.Action == "create_rule" {
		rule, err = svc.CreateRule(ctx, booksID, rule)
	} else {
		rule, err = svc.ChangeRule(ctx, booksID, rule)
	}

	return manageRuleOut{RuleID: rule.ID.String()}, err
}
