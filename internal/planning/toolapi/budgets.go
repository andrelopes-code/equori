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

// planView is the budget plan of the month (budget plan amendment A129): the reference income
// less installments, savings and the counted budgets is the unassigned amount.
type planView struct {
	Source         string        `json:"source"`
	ExpectedIncome tool.Money    `json:"expected_income,omitzero"`
	AverageIncome  tool.Money    `json:"average_income,omitzero"`
	AverageMonths  int           `json:"average_months,omitzero"`
	Reference      tool.Money    `json:"reference,omitzero"`
	Installments   tool.Money    `json:"installments"`
	Savings        tool.Money    `json:"savings"`
	Planned        tool.Money    `json:"planned"`
	Unassigned     tool.Money    `json:"unassigned,omitzero"`
	Rows           []planRowView `json:"rows"`
	// Buckets is the income split with each bucket's target, planned and spent amounts (A230).
	Buckets []planBucketView `json:"buckets,omitzero"`
	// BucketsFrom is the start month of the version that holds Buckets (A240).
	BucketsFrom string `json:"buckets_from,omitzero"`
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

// toPlanView leaves a figure the plan does not have at its zero value, which the output omits.
func toPlanView(p app.Plan, accounts map[uuid.UUID]Account) (planView, error) {
	m := func(amount int64) (tool.Money, error) { return moneyOf(amount, p.Currency) }
	optional := func(v *int64) (tool.Money, error) {
		if v == nil {
			return tool.Money{}, nil
		}

		return m(*v)
	}
	out := planView{Source: string(p.Reference.Source), AverageMonths: p.AverageMonths}

	var err error
	if out.ExpectedIncome, err = optional(p.Expected); err != nil {
		return planView{}, err
	}

	if out.AverageIncome, err = optional(p.Average); err != nil {
		return planView{}, err
	}

	if ref, ok := p.ReferenceAmount(); ok {
		rest, _ := p.Unassigned()

		if out.Reference, err = optional(&ref); err != nil {
			return planView{}, err
		}

		if out.Unassigned, err = optional(&rest); err != nil {
			return planView{}, err
		}
	}

	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{{p.Installments, &out.Installments}, {p.Savings, &out.Savings}, {p.Planned, &out.Planned}} {
		if *f.into, err = m(f.amount); err != nil {
			return planView{}, err
		}
	}

	if out.Rows, err = planRowViews(p, accounts); err != nil {
		return planView{}, err
	}

	if out.Buckets, err = planBucketViews(p, accounts); err != nil {
		return planView{}, err
	}

	if len(out.Buckets) > 0 {
		out.BucketsFrom = p.BucketsFrom.Format(monthLayout)
	}

	return out, nil
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
			"With kind plan it returns the month's budget plan instead: the reference income, the installments and savings it pays, the budgets and the unassigned rest. " +
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
