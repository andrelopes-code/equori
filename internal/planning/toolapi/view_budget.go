package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type budgetItem struct {
	BudgetID string     `json:"budget_id"`
	Name     string     `json:"name"`
	Spent    view.Money `json:"spent"`
	Limit    view.Money `json:"limit"`
	Over     view.Money `json:"over"`
}

// budgetData holds the month's budgets and the day the pace mark stands on (answer views design, budget).
type budgetData struct {
	Month string       `json:"month"`
	Day   int          `json:"day"`
	Days  int          `json:"days"`
	Items []budgetItem `json:"items"`
}

// Views returns the builders of the planning reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_budgets_and_goals", Form: "budget"}: budgetFormView,
	}
}

func budgetFormView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	var out getBudgetsAndGoalsOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_budgets_and_goals output: %w", err)
	}

	first, err := time.Parse("2006-01", out.Month)
	if err != nil {
		return view.Payload{}, fmt.Errorf("parse month %q: %w", out.Month, err)
	}

	data := budgetData{Month: out.Month, Items: []budgetItem{}}
	data.Day, data.Days = monthDay(first, today)

	for _, b := range out.Budgets {
		item, err := budgetItemOf(b)
		if err != nil {
			return view.Payload{}, err
		}

		data.Items = append(data.Items, item)
	}

	last := first.AddDate(0, 1, -1)

	return view.Payload{
		Title:   view.Text{Key: "assistantView.budget.title"},
		Window:  view.Window{From: first.Format(time.DateOnly), To: last.Format(time.DateOnly)},
		Verdict: budgetVerdict(data.Items),
		Open: &view.Link{
			Screen: "/planning",
			Params: map[string]string{"tab": "budgets", "month": out.Month},
		},
		Rows: budgetRows(data.Items),
		Data: data,
	}, nil
}

// monthDay is the day of the month the pace mark stands on and the month's length: today inside
// the month, its last day for a past month, 0 for a future one.
func monthDay(first, today time.Time) (int, int) {
	days := first.AddDate(0, 1, -1).Day()

	switch {
	case today.Before(first):
		return 0, days
	case today.Year() == first.Year() && today.Month() == first.Month():
		return today.Day(), days
	default:
		return days, days
	}
}

func budgetItemOf(b budgetView) (budgetItem, error) {
	spent, err := view.Amount(b.Spent.Amount, b.Spent.Currency)
	if err != nil {
		return budgetItem{}, err
	}

	planned, err := view.Amount(b.Planned.Amount, b.Planned.Currency)
	if err != nil {
		return budgetItem{}, err
	}

	carried, err := view.Amount(b.Carried.Amount, b.Carried.Currency)
	if err != nil {
		return budgetItem{}, err
	}

	if carried.Currency != planned.Currency || spent.Currency != planned.Currency {
		return budgetItem{}, view.ErrCurrencies
	}

	limit := view.Money{Amount: planned.Amount + carried.Amount, Currency: planned.Currency}
	over := view.Money{Amount: max(spent.Amount-limit.Amount, 0), Currency: planned.Currency}

	return budgetItem{
		BudgetID: b.BudgetID,
		Name:     b.CategoryName,
		Spent:    spent,
		Limit:    limit,
		Over:     over,
	}, nil
}

// budgetVerdict names how many budgets passed their limit and the largest excess.
func budgetVerdict(items []budgetItem) view.Text {
	if len(items) == 0 {
		return view.Text{Key: "assistantView.budget.empty"}
	}

	var count int64

	var top budgetItem
	for _, it := range items {
		if it.Over.Amount > 0 {
			count++

			if it.Over.Amount > top.Over.Amount {
				top = it
			}
		}
	}

	if count == 0 {
		return view.Text{Key: "assistantView.budget.verdict_within"}
	}

	return view.Text{Key: "assistantView.budget.verdict_over", Params: map[string]view.Value{
		"count":  view.CountValue(count),
		"name":   view.TextValue(top.Name),
		"amount": view.MoneyValue(top.Over),
	}}
}

func budgetRows(items []budgetItem) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.category",
			"assistantView.col.spent",
			"assistantView.col.limit",
		},
		Rows: [][]view.Value{},
	}
	for _, it := range items {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(it.Name),
				view.MoneyValue(it.Spent),
				view.MoneyValue(it.Limit),
			},
		)
	}

	return t
}
