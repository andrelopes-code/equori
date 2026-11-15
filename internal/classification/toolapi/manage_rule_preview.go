package toolapi

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// previewManageRule returns the preview handler of manage_rule.
func previewManageRule(
	svc *app.Service,
	names Names,
	today func(context.Context) time.Time,
) func(context.Context, int64, manageRuleIn) (tool.Preview, error) {
	return func(ctx context.Context, booksID int64, in manageRuleIn) (tool.Preview, error) {
		p, err := parseManage(in)
		if err != nil {
			return tool.Preview{}, err
		}

		categories, payees, err := names(ctx, booksID)
		if err != nil {
			return tool.Preview{}, err
		}

		pv := tool.Preview{Action: "manage_rule." + string(in.Action)}
		err = previewAction(ctx, svc, booksID, in, p, categories, payees, today, &pv)

		return pv, err
	}
}

// previewAction fills pv with the change that in.Action proposes.
func previewAction(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageRuleIn,
	p ids,
	categories, payees map[uuid.UUID]string,
	today func(context.Context) time.Time,
	pv *tool.Preview,
) error {
	switch in.Action {
	case "create_rule", "change_rule":
		return previewRule(ctx, svc, booksID, in, p, categories, payees, pv)
	case "delete_rule":
		return previewDeleteRule(ctx, svc, booksID, p, pv)
	case "reorder_rules":
		return previewReorder(ctx, svc, booksID, p, pv)
	case "accept_suggestion", "dismiss_suggestion":
		return previewSuggestion(ctx, svc, booksID, in, p, categories, payees, pv)
	case "run_rules":
		return previewRunRules(ctx, svc, booksID, today, pv)
	case "map_source_category":
		return previewSourceCategory(ctx, svc, booksID, p, categories, pv)
	case "create_alias", "change_alias", "delete_alias":
		return previewAlias(ctx, svc, booksID, in, p, payees, pv)
	}

	return nil
}

func previewRule(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageRuleIn,
	p ids,
	categories, payees map[uuid.UUID]string,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	var err error

	var old domain.Rule
	if in.Action == "change_rule" {
		if old, err = svc.Rule(ctx, booksID, p.rule); err != nil {
			return err
		}
	}

	rule, err := buildRule(in, p, old)
	if err != nil {
		return err
	}

	pv.Target = rule.Name

	preview, err := svc.PreviewRule(ctx, booksID, rule)
	if err != nil {
		return err
	}

	pv.Changes = append(
		ruleChanges(in, p, old, rule, categories, payees),
		tool.Change{
			Field: "count",
			After: text(strconv.Itoa(preview.WouldCategorize.Count)),
		},
	)

	return nil
}

func previewDeleteRule(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	p ids,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	old, err := svc.Rule(ctx, booksID, p.rule)
	if err != nil {
		return err
	}

	pv.Target, pv.Destructive = old.Name, true
	pv.Changes = []tool.Change{{Field: "rule", Before: text(old.Name)}}

	return nil
}

func previewReorder(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	p ids,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	rules, err := allRules(ctx, svc, booksID)
	if err != nil {
		return err
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
		return &domain.FieldError{
			Field:   "rule_ids",
			Message: "must list every rule exactly once",
			Err:     domain.ErrValidation,
		}
	}

	for i, id := range p.rules {
		if r := byID[id]; r.Priority != i+1 {
			pv.Changes = append(
				pv.Changes,
				tool.Change{
					Field:  "priority",
					Before: text(fmt.Sprintf("%s: %d", r.Name, r.Priority)),
					After:  text(fmt.Sprintf("%s: %d", r.Name, i+1)),
				},
			)
		}
	}

	return nil
}

func previewSuggestion(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageRuleIn,
	p ids,
	categories, payees map[uuid.UUID]string,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	s, err := findSuggestion(ctx, svc, booksID, p.suggestion)
	if err != nil {
		return err
	}

	if s.State != app.SuggestionPending {
		return app.ErrSuggestionClosed
	}

	pv.Target = conditionsText(s.Conditions)
	if in.Action == "dismiss_suggestion" {
		pv.Changes = []tool.Change{
			{Field: "status", Before: text(s.State), After: text(app.SuggestionDismissed)},
		}

		return nil
	}

	pv.Changes = []tool.Change{
		{
			Field: "rule",
			After: text(in.Name),
		},
		{Field: "pattern", After: text(conditionsText(s.Conditions))},
		{Field: "category", After: text(actionsText(s.Actions, categories, payees))},
	}

	return nil
}

func previewRunRules(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	today func(context.Context) time.Time,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	st, err := svc.Statistics(ctx, booksID, time.Time{}, today(ctx))
	if err != nil {
		return err
	}

	pv.Changes = []tool.Change{
		{
			Field: "count",
			After: text(strconv.Itoa(st.Uncategorized)),
		},
	}

	return nil
}

func previewSourceCategory(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	p ids,
	categories map[uuid.UUID]string,
	pv *tool.Preview,
) error {
	text := tool.TextValue

	sc, err := findSourceCategory(ctx, svc, booksID, p.source)
	if err != nil {
		return err
	}

	if _, ok := categories[p.category]; !ok {
		return &domain.FieldError{
			Field:   "category_id",
			Message: "unknown category",
			Err:     domain.ErrValidation,
		}
	}

	pv.Target = sc.Name
	pv.Changes = []tool.Change{
		{
			Field:  "category",
			Before: text(categories[sc.CategoryID]),
			After:  text(categories[p.category]),
		},
	}

	return nil
}

func previewAlias(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageRuleIn,
	p ids,
	payees map[uuid.UUID]string,
	pv *tool.Preview,
) error {
	var err error

	var old domain.Alias
	if in.Action != "create_alias" {
		if old, err = svc.Alias(ctx, booksID, p.alias); err != nil {
			return err
		}
	}

	if in.Action == "delete_alias" {
		previewAliasDelete(pv, old, payees)

		return nil
	}

	if _, err := domain.NewAlias(in.alias(p.alias, p.payee)); err != nil {
		return err
	}

	if _, ok := payees[p.payee]; !ok {
		return &domain.FieldError{
			Field:   "payee_id",
			Message: "unknown payee",
			Err:     domain.ErrValidation,
		}
	}

	previewAliasChange(pv, in, p, payees, old)

	return nil
}

// previewAliasDelete describes the alias that delete_alias removes.
func previewAliasDelete(pv *tool.Preview, old domain.Alias, payees map[uuid.UUID]string) {
	text := tool.TextValue

	pv.Target, pv.Destructive = old.Pattern, true
	pv.Changes = []tool.Change{
		{Field: "pattern", Before: text(old.Pattern)},
		{Field: "payee", Before: text(payees[old.PayeeID])},
	}
}

// previewAliasChange describes the alias that create_alias or change_alias writes; old is the stored alias.
func previewAliasChange(
	pv *tool.Preview,
	in manageRuleIn,
	p ids,
	payees map[uuid.UUID]string,
	old domain.Alias,
) {
	text := tool.TextValue

	pv.Target = in.Pattern

	pv.Changes = []tool.Change{
		{Field: "pattern", After: text(in.Pattern)},
		{Field: "kind", After: text(string(in.MatchType))},
		{Field: "payee", After: text(payees[p.payee])},
	}
	if in.Action == "change_alias" {
		pv.Changes[0].Before, pv.Changes[1].Before, pv.Changes[2].Before = text(
			old.Pattern,
		), text(
			string(old.MatchType),
		), text(
			payees[old.PayeeID],
		)
	}
}
