package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getBudgetsAndGoalsKind string

func (getBudgetsAndGoalsKind) Values() []string {
	return []string{"budgets", "goals", "both", "plan", "split"}
}

type getBudgetsAndGoalsIn struct {
	Month string                 `json:"month,omitzero" jsonschema:"month of the budget progress; the current month when absent; written YYYY-MM"`
	Kind  getBudgetsAndGoalsKind `json:"kind,omitzero"  jsonschema:"budgets, goals or both; both when absent; plan returns only the month's budget plan; split the income split of the month and the five before"`
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
	CountsAsSavings  bool       `json:"counts_as_savings,omitzero"`
	// Spent sums the expenses the goal paid; absent at zero (planning coherence A256).
	Spent tool.Money `json:"spent,omitzero"`
	// AllocatedAccounts lists the shared accounts with what the goal holds in each and what each
	// has available; OverAllocated and SharedWith are absent when empty (A255).
	AllocatedAccounts []allocatedAccountView `json:"allocated_accounts,omitzero"`
	OverAllocated     tool.Money             `json:"over_allocated,omitzero"`
	SharedWith        []string               `json:"shared_with,omitzero"`
}

type allocatedAccountView struct {
	AccountID string     `json:"account_id"`
	Allocated tool.Money `json:"allocated"`
	Available tool.Money `json:"available"`
}

type planRowView struct {
	CategoryID   string     `json:"category_id"`
	CategoryName string     `json:"category_name"`
	Planned      tool.Money `json:"planned"`
	LastMonth    tool.Money `json:"last_month"`
	Average      tool.Money `json:"average"`
	Counted      bool       `json:"counted"`
	NextChange   string     `json:"next_change,omitzero"`
}

type getBudgetsAndGoalsOut struct {
	Month   string       `json:"month"`
	Budgets []budgetView `json:"budgets"`
	Goals   []goalView   `json:"goals"`
	Plan    planView     `json:"plan,omitzero"`
	Split   []splitMonth `json:"split,omitzero"`
	// Versions lists every version of the bucket method with kind split (A240).
	Versions []bucketVersionView `json:"versions,omitzero"`
}

// planBucketsFrom returns the first month of the plan's bucket method; empty without one.
func planBucketsFrom(p app.Plan) string {
	if len(p.Buckets) == 0 {
		return ""
	}

	return p.BucketsFrom.Format(monthLayout)
}

func planRowViews(p app.Plan, accounts map[uuid.UUID]Account) ([]planRowView, error) {
	rows := make([]planRowView, len(p.Rows))
	for i, r := range p.Rows {
		v := planRowView{
			CategoryID:   r.CategoryID.String(),
			CategoryName: accountName(accounts, r.CategoryID),
			Counted:      r.Counted,
		}
		if r.HasNextChange {
			v.NextChange = r.NextChange.Format(monthLayout)
		}

		for _, f := range []struct {
			amount int64
			into   *tool.Money
		}{{r.Planned, &v.Planned}, {r.LastMonth, &v.LastMonth}, {r.Average, &v.Average}} {
			var err error
			if *f.into, err = moneyOf(f.amount, p.Currency); err != nil {
				return nil, err
			}
		}

		rows[i] = v
	}

	return rows, nil
}

func toGoalView(g app.GoalView) (goalView, error) {
	v := goalView{
		GoalID:          g.ID.String(),
		Name:            g.Name,
		ProgressBP:      g.Progress.ProgressBP,
		DueOn:           tool.DateOf(g.DueOn),
		CountsAsSavings: g.CountsAsSavings,
	}
	if g.Spent.Amount() != 0 {
		v.Spent = tool.MoneyOf(g.Spent)
	}

	for _, a := range g.AllocatedAccounts {
		v.AllocatedAccounts = append(v.AllocatedAccounts, allocatedAccountView{
			AccountID: a.AccountID.String(),
			Allocated: tool.MoneyOf(a.Allocated),
			Available: tool.MoneyOf(a.Available),
		})
	}

	if g.OverAllocated != nil {
		v.OverAllocated = tool.MoneyOf(*g.OverAllocated)
	}

	for _, id := range g.SharedWith {
		v.SharedWith = append(v.SharedWith, id.String())
	}

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
			"With kind plan it returns the month's budget plan instead: the reference income, the installments, savings and goal deposits it pays, the budgets and the unassigned rest. " +
			"Use it for how a budget or goal is going, or how much income still has no budget. " +
			"Do not use it for spending by category without a budget: get_category_totals does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, booksID int64, in getBudgetsAndGoalsIn) (getBudgetsAndGoalsOut, error) {
		month, err := parseMonth("month", in.Month, firstOfMonth(clk.Today(ctx)))
		if err != nil {
			return getBudgetsAndGoalsOut{}, err
		}

		out := getBudgetsAndGoalsOut{
			Month:   month.Format(monthLayout),
			Budgets: []budgetView{},
			Goals:   []goalView{},
		}
		if in.Kind == "plan" {
			err := fillPlan(ctx, svc, l, booksID, month, &out)

			return out, err
		}

		if in.Kind == "split" {
			out.Split, err = splitMonths(ctx, svc, booksID, month)
			if err != nil {
				return out, err
			}

			out.Versions, err = bucketVersionViews(ctx, svc, booksID)

			return out, err
		}

		if in.Kind != "goals" {
			if err := fillBudgets(ctx, svc, l, booksID, month, &out); err != nil {
				return out, err
			}
		}

		if in.Kind != "budgets" {
			if err := fillGoals(ctx, svc, booksID, &out); err != nil {
				return out, err
			}
		}

		return out, nil
	})
}

func fillPlan(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	month time.Time,
	out *getBudgetsAndGoalsOut,
) error {
	p, err := svc.BudgetPlan(ctx, booksID, month)
	if err != nil {
		return err
	}

	accounts, err := l.Accounts(ctx, booksID)
	if err != nil {
		return err
	}

	out.Plan, err = toPlanView(p, accounts)

	return err
}

func fillBudgets(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	month time.Time,
	out *getBudgetsAndGoalsOut,
) error {
	accounts, err := l.Accounts(ctx, booksID)
	if err != nil {
		return err
	}

	r := page.Request[app.IDKey]{Limit: page.MaxLimit}
	for {
		bs, next, err := svc.ListBudgets(ctx, booksID, r)
		if err != nil {
			return err
		}

		for _, b := range bs {
			// A budget that starts after the month has no progress to report.
			if len(b.Amounts) == 0 || b.Amounts[0].EffectiveFrom.After(month) {
				continue
			}

			v, err := toBudgetView(ctx, svc, booksID, b, month, accounts)
			if err != nil {
				return err
			}

			out.Budgets = append(out.Budgets, v)
		}

		if next == nil {
			break
		}

		r.After = next
	}

	return nil
}

func toBudgetView(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	b domain.Budget,
	month time.Time,
	accounts map[uuid.UUID]Account,
) (budgetView, error) {
	p, currency, err := svc.BudgetProgress(ctx, booksID, b.ID, month)
	if err != nil {
		return budgetView{}, err
	}

	v := budgetView{
		BudgetID:     b.ID.String(),
		CategoryName: accountName(accounts, b.CategoryID),
		Rollover:     b.Rollover,
	}
	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{{p.Planned, &v.Planned}, {p.Carried, &v.Carried}, {p.Spent, &v.Spent}, {p.Available, &v.Available}} {
		if *f.into, err = moneyOf(f.amount, currency); err != nil {
			return budgetView{}, err
		}
	}

	return v, nil
}

func fillGoals(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	out *getBudgetsAndGoalsOut,
) error {
	r := page.Request[app.IDKey]{Limit: page.MaxLimit}
	for {
		gs, next, err := svc.ListGoals(ctx, booksID, r)
		if err != nil {
			return err
		}

		for _, g := range gs {
			v, err := toGoalView(g)
			if err != nil {
				return err
			}

			out.Goals = append(out.Goals, v)
		}

		if next == nil {
			break
		}

		r.After = next
	}

	return nil
}
