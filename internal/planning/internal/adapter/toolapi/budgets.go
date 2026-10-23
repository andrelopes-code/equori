package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getBudgetsAndGoalsKind string

func (getBudgetsAndGoalsKind) Values() []string { return []string{"budgets", "goals", "both"} }

type getBudgetsAndGoalsIn struct {
	Month string                 `json:"month,omitzero" jsonschema:"month of the budget progress; the current month when absent; written YYYY-MM"`
	Kind  getBudgetsAndGoalsKind `json:"kind,omitzero" jsonschema:"budgets, goals or both; both when absent"`
}

type budgetView struct {
	BudgetID     string     `json:"budget_id"`
	CategoryName string     `json:"category_name"`
	Planned      tool.Money `json:"planned"`
	Carried      tool.Money `json:"carried"`
	Spent        tool.Money `json:"spent"`
	Available    tool.Money `json:"available"`
	Rollover     bool       `json:"rollover"`
}

type goalView struct {
	GoalID           string     `json:"goal_id"`
	Name             string     `json:"name"`
	Target           tool.Money `json:"target"`
	Current          tool.Money `json:"current"`
	Remaining        tool.Money `json:"remaining"`
	ProgressBP       int        `json:"progress_bp"`
	DueOn            tool.Date  `json:"due_on"`
	TrailingReturnBP int        `json:"trailing_return_bp,omitzero"`
}

type getBudgetsAndGoalsOut struct {
	Month   string       `json:"month"`
	Budgets []budgetView `json:"budgets"`
	Goals   []goalView   `json:"goals"`
}

func toGoalView(g app.GoalView) (goalView, error) {
	v := goalView{GoalID: g.ID.String(), Name: g.Name, ProgressBP: g.Progress.ProgressBP, DueOn: tool.DateOf(g.DueOn)}
	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{{g.Target, &v.Target}, {g.Progress.Current, &v.Current}, {g.Progress.Remaining, &v.Remaining}} {
		var err error
		if *f.into, err = moneyOf(f.amount, g.Currency); err != nil {
			return goalView{}, err
		}
	}
	if g.Trailing != nil {
		v.TrailingReturnBP = g.Trailing.BP
	}
	return v, nil
}

func getBudgetsAndGoals(svc *app.Service, l Ledger, clk clock.Clock) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_budgets_and_goals",
		Description: "Returns the monthly budgets with planned, carried, spent and available amounts for a month, and the goals with their target, current value, progress and trailing return. " +
			"Use it for how a budget or goal is going. " +
			"Do not use it for spending by category without a budget: get_category_totals does.",
		Effect: tool.ReadOnly, Idempotent: true,
	}, func(ctx context.Context, userID int64, in getBudgetsAndGoalsIn) (getBudgetsAndGoalsOut, error) {
		month, err := parseMonth("month", in.Month, firstOfMonth(clk.Today()))
		if err != nil {
			return getBudgetsAndGoalsOut{}, err
		}
		out := getBudgetsAndGoalsOut{Month: month.Format(monthLayout), Budgets: []budgetView{}, Goals: []goalView{}}
		if in.Kind != "goals" {
			accounts, err := l.Accounts(ctx, userID)
			if err != nil {
				return out, err
			}
			r := page.Request[app.IDKey]{Limit: page.MaxLimit}
			for {
				bs, next, err := svc.ListBudgets(ctx, userID, r)
				if err != nil {
					return out, err
				}
				for _, b := range bs {
					// A budget that starts after the month has no progress to report.
					if len(b.Amounts) == 0 || b.Amounts[0].EffectiveFrom.After(month) {
						continue
					}
					p, currency, err := svc.BudgetProgress(ctx, userID, b.ID, month)
					if err != nil {
						return out, err
					}
					v := budgetView{BudgetID: b.ID.String(), CategoryName: accountName(accounts, b.CategoryID), Rollover: b.Rollover}
					for _, f := range []struct {
						amount int64
						into   *tool.Money
					}{{p.Planned, &v.Planned}, {p.Carried, &v.Carried}, {p.Spent, &v.Spent}, {p.Available, &v.Available}} {
						if *f.into, err = moneyOf(f.amount, currency); err != nil {
							return out, err
						}
					}
					out.Budgets = append(out.Budgets, v)
				}
				if next == nil {
					break
				}
				r.After = next
			}
		}
		if in.Kind != "budgets" {
			r := page.Request[app.IDKey]{Limit: page.MaxLimit}
			for {
				gs, next, err := svc.ListGoals(ctx, userID, r)
				if err != nil {
					return out, err
				}
				for _, g := range gs {
					v, err := toGoalView(g)
					if err != nil {
						return out, err
					}
					out.Goals = append(out.Goals, v)
				}
				if next == nil {
					break
				}
				r.After = next
			}
		}
		return out, nil
	})
}
