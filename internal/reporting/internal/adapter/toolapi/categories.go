package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

type categoryClass string

func (categoryClass) Values() []string { return []string{"income", "expense"} }

type getCategoryTotalsIn struct {
	Class categoryClass `json:"class" jsonschema:"expense totals spending, income totals earnings; both are positive"`
	From  tool.Date     `json:"from" jsonschema:"first date, inclusive"`
	To    tool.Date     `json:"to" jsonschema:"last date, inclusive; at most 366 days after from"`
	tool.PageArgs
}

type categoryView struct {
	AccountID    string     `json:"account_id"`
	Name         string     `json:"name"`
	ParentID     string     `json:"parent_id,omitzero"`
	ParentName   string     `json:"parent_name,omitzero"`
	Total        tool.Money `json:"total" jsonschema:"postings on the category itself"`
	SubtreeTotal tool.Money `json:"subtree_total" jsonschema:"postings on the category and its descendants"`
}

type getCategoryTotalsOut struct {
	From       tool.Date      `json:"from"`
	To         tool.Date      `json:"to"`
	Categories []categoryView `json:"categories"`
	NextCursor string         `json:"next_cursor,omitzero" jsonschema:"present when more categories follow; pass it as cursor"`
}

func getCategoryTotals(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_category_totals",
		Description: "Totals the income or expense categories in a period, each with its own total and the total of its subtree, " +
			"in category name order; only categories with postings and their ancestors are listed. " +
			"Use it for how much was spent or earned by category. " +
			"Do not use it for the transactions behind a total: search_transactions with account_id lists them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getCategoryTotalsIn) (getCategoryTotalsOut, error) {
		totals, err := svc.CategoryTotals(ctx, userID, string(in.Class), in.From.Time, in.To.Time)
		if err != nil {
			return getCategoryTotalsOut{}, err
		}
		names := make(map[uuid.UUID]string, len(totals))
		for _, t := range totals {
			names[t.AccountID] = t.Name
		}
		views := []categoryView{}
		for _, t := range active(totals) {
			total, err := money.New(t.Total, money.Currency(t.Instrument))
			if err != nil {
				return getCategoryTotalsOut{}, err
			}
			subtree, err := money.New(t.SubtreeTotal, money.Currency(t.Instrument))
			if err != nil {
				return getCategoryTotalsOut{}, err
			}
			v := categoryView{AccountID: t.AccountID.String(), Name: t.Name, Total: tool.MoneyOf(total), SubtreeTotal: tool.MoneyOf(subtree)}
			if t.ParentID != uuid.Nil {
				v.ParentID, v.ParentName = t.ParentID.String(), names[t.ParentID]
			}
			views = append(views, v)
		}
		out := getCategoryTotalsOut{From: in.From, To: in.To}
		out.Categories, out.NextCursor, err = tool.PageOf(views, func(v categoryView) string { return v.AccountID }, in.PageArgs)
		return out, err
	})
}

// active keeps the categories with postings of their own and their ancestors, in order. A
// subtree total is not enough: a refund on one child can cancel a purchase on another.
func active(totals []app.CategoryTotal) []app.CategoryTotal {
	parent := make(map[uuid.UUID]uuid.UUID, len(totals))
	for _, t := range totals {
		parent[t.AccountID] = t.ParentID
	}
	keep := map[uuid.UUID]bool{}
	for _, t := range totals {
		if t.Total == 0 {
			continue
		}
		for id := t.AccountID; id != uuid.Nil && !keep[id]; id = parent[id] {
			keep[id] = true
		}
	}
	var out []app.CategoryTotal
	for _, t := range totals {
		if keep[t.AccountID] {
			out = append(out, t)
		}
	}
	return out
}
