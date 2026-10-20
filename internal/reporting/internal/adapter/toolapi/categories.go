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
}

type categoryView struct {
	AccountID    string     `json:"account_id"`
	Name         string     `json:"name"`
	ParentID     string     `json:"parent_id,omitzero"`
	Total        tool.Money `json:"total" jsonschema:"postings on the category itself"`
	SubtreeTotal tool.Money `json:"subtree_total" jsonschema:"postings on the category and its descendants"`
}

type getCategoryTotalsOut struct {
	From       tool.Date      `json:"from"`
	To         tool.Date      `json:"to"`
	Categories []categoryView `json:"categories"`
}

func getCategoryTotals(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_category_totals",
		Description: "Totals the income or expense categories in a period, each with its own total and the total of its subtree, " +
			"in category name order. Closed categories with zero totals are omitted.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getCategoryTotalsIn) (getCategoryTotalsOut, error) {
		totals, err := svc.CategoryTotals(ctx, userID, string(in.Class), in.From.Time, in.To.Time)
		if err != nil {
			return getCategoryTotalsOut{}, err
		}
		out := getCategoryTotalsOut{From: in.From, To: in.To, Categories: make([]categoryView, len(totals))}
		for i, t := range totals {
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
				v.ParentID = t.ParentID.String()
			}
			out.Categories[i] = v
		}
		return out, nil
	})
}
