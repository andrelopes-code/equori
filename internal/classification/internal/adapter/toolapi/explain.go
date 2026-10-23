package toolapi

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type explainCategorizationView string

func (explainCategorizationView) Values() []string {
	return []string{"transactions", "statistics", "rule_preview"}
}

type explainCategorizationIn struct {
	View                explainCategorizationView `json:"view" jsonschema:"what to return"`
	TransactionIDs      []string                  `json:"transaction_ids,omitzero" jsonschema:"for transactions: IDs from search_transactions; at most 50"`
	From                tool.Date                 `json:"from,omitzero" jsonschema:"for statistics: first date"`
	To                  tool.Date                 `json:"to,omitzero" jsonschema:"for statistics: last date"`
	DescriptionContains string                    `json:"description_contains,omitzero" jsonschema:"for rule_preview: text the description must contain"`
	CategoryID          string                    `json:"category_id,omitzero" jsonschema:"for rule_preview: category the rule would set"`
}

type categorizationView struct {
	TransactionID string `json:"transaction_id"`
	Method        string `json:"method,omitzero"`
	RuleName      string `json:"rule_name,omitzero"`
	DecidedAt     string `json:"decided_at"`
}

type statisticsView struct {
	From          tool.Date `json:"from"`
	To            tool.Date `json:"to"`
	Total         int       `json:"total"`
	Rule          int       `json:"rule"`
	Source        int       `json:"source"`
	History       int       `json:"history"`
	Manual        int       `json:"manual"`
	Uncategorized int       `json:"uncategorized"`
}

type rulePreviewView struct {
	DescriptionContains string `json:"description_contains"`
	WouldCategorize     int    `json:"would_categorize"`
	Conflicts           int    `json:"conflicts"`
}

type explainCategorizationOut struct {
	Items       []categorizationView `json:"items,omitzero"`
	Statistics  statisticsView       `json:"statistics,omitzero"`
	RulePreview rulePreviewView      `json:"rule_preview,omitzero"`
}

// descriptionRule is the rule of one condition, description contains text, and the action set category.
func descriptionRule(name, text string, categoryID, payeeID uuid.UUID) (domain.Rule, error) {
	actions := []domain.ActionDoc{{Type: string(domain.ActionSetCategory), CategoryID: categoryID}}
	if payeeID != uuid.Nil {
		actions = append(actions, domain.ActionDoc{Type: string(domain.ActionSetPayee), PayeeID: payeeID})
	}
	return domain.RuleFromDocs(domain.Rule{Name: name, Enabled: true},
		[]domain.ConditionDoc{{Field: string(domain.FieldDescription), Operator: string(domain.OpContains), Value: text}}, actions)
}

func explainCategorization(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "explain_categorization",
		Description: "Explains how transactions got their categories (rule, source category, history or manual), counts transactions by categorization method in a period, or previews what a rule would categorize. " +
			"Use it for why a transaction has a category, how much is categorized automatically, or before proposing a rule. " +
			"Do not use it to change a category: categorize_transactions does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, userID int64, in explainCategorizationIn) (explainCategorizationOut, error) {
		fields := []field{
			{"transaction_ids", len(in.TransactionIDs) > 0}, {"from", !in.From.IsZero()}, {"to", !in.To.IsZero()},
			{"description_contains", in.DescriptionContains != ""}, {"category_id", in.CategoryID != ""},
		}
		name := "view " + string(in.View)
		var err error
		switch in.View {
		case "transactions":
			err = required(name, fields, "transaction_ids")
		case "statistics":
			err = required(name, fields, "from", "to")
		default:
			err = required(name, fields, "description_contains", "category_id")
		}
		if err != nil {
			return explainCategorizationOut{}, err
		}
		switch in.View {
		case "transactions":
			if len(in.TransactionIDs) > 50 {
				return explainCategorizationOut{}, tool.InvalidArgument("transaction_ids", "must have 1 to 50 ids")
			}
			ids := make([]uuid.UUID, len(in.TransactionIDs))
			for i, s := range in.TransactionIDs {
				if ids[i], err = optionalID(s, "transaction_ids"); err != nil {
					return explainCategorizationOut{}, err
				}
			}
			recs, err := svc.Categorizations(ctx, userID, ids)
			if err != nil {
				return explainCategorizationOut{}, err
			}
			out := explainCategorizationOut{Items: []categorizationView{}}
			ruleNames := map[uuid.UUID]string{}
			for _, r := range recs {
				v := categorizationView{TransactionID: r.TransactionID.String(), Method: r.Method, DecidedAt: r.DecidedAt.Format(time.RFC3339)}
				if r.RuleID != uuid.Nil {
					n, ok := ruleNames[r.RuleID]
					if !ok {
						rule, err := svc.Rule(ctx, userID, r.RuleID)
						if err != nil && !errors.Is(err, app.ErrNotFound) {
							return explainCategorizationOut{}, err
						}
						n = rule.Name
						ruleNames[r.RuleID] = n
					}
					v.RuleName = n
				}
				out.Items = append(out.Items, v)
			}
			return out, nil
		case "statistics":
			if in.To.Before(in.From.Time) {
				return explainCategorizationOut{}, tool.InvalidArgument("to", "must not be before from")
			}
			st, err := svc.Statistics(ctx, userID, in.From.Time, in.To.Time)
			return explainCategorizationOut{Statistics: statisticsView{
				From: in.From, To: in.To, Total: st.Total, Rule: st.Rule, Source: st.Source, History: st.History, Manual: st.Manual, Uncategorized: st.Uncategorized,
			}}, err
		}
		category, err := optionalID(in.CategoryID, "category_id")
		if err != nil {
			return explainCategorizationOut{}, err
		}
		rule, err := descriptionRule("preview", in.DescriptionContains, category, uuid.Nil)
		if err != nil {
			return explainCategorizationOut{}, err
		}
		p, err := svc.PreviewRule(ctx, userID, rule)
		return explainCategorizationOut{RulePreview: rulePreviewView{
			DescriptionContains: in.DescriptionContains, WouldCategorize: p.WouldCategorize.Count, Conflicts: p.Conflicts.Count,
		}}, err
	})
}
