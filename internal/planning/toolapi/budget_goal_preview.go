package toolapi

import (
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func previewBudgetOrGoal(in manageBudgetOrGoalIn, p budgetGoalPlan) (tool.Preview, error) {
	pv := tool.Preview{Action: "manage_budget_or_goal." + string(in.Action)}

	accounts := tool.TextValue(strings.Join(p.accountNames, ", "))
	switch in.Action {
	case "create_budget":
		pv.Target = p.categoryName
		pv.Changes = []tool.Change{
			{
				Field: "budget",
				After: tool.TextValue(p.categoryName),
			},
			{Field: "amount", After: tool.MoneyValue(*p.amount)},
			{Field: "date", After: tool.DateValue(p.month)},
		}
	case "set_budget_amount":
		if err := previewBudgetAmount(&pv, p); err != nil {
			return tool.Preview{}, err
		}
	case "delete_budget":
		pv.Target, pv.Destructive = p.categoryName, true
		pv.Changes = []tool.Change{{Field: "budget", Before: tool.TextValue(p.categoryName)}}
	case "create_goal":
		previewGoalCreate(&pv, in, p, accounts)
	case "update_goal":
		if err := previewGoalUpdate(&pv, in, p, accounts); err != nil {
			return tool.Preview{}, err
		}
	case "delete_goal":
		pv.Target, pv.Destructive = p.goal.Name, true
		pv.Changes = []tool.Change{{Field: "goal", Before: tool.TextValue(p.goal.Name)}}
	case "save_plan":
		if err := previewPlanSave(&pv, in, p); err != nil {
			return tool.Preview{}, err
		}
	case "save_buckets":
		previewBuckets(&pv, p)
	case "move_category":
		previewMove(&pv, p)
	case "link_expense", "unlink_expense":
		previewGoalExpense(&pv, in, p)
	case "allocate":
		previewAllocation(&pv, p)
	}

	return pv, nil
}

func previewGoalCreate(
	pv *tool.Preview,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
	accounts tool.Value,
) {
	pv.Target = in.Name

	pv.Changes = []tool.Change{
		{Field: "goal", After: tool.TextValue(in.Name)},
		{Field: "target", After: tool.MoneyValue(*p.amount)},
		{Field: "due_on", After: tool.DateValue(in.DueOn.Time)},
		{Field: "accounts", After: accounts},
	}
	if in.CountsAsSavings.B {
		pv.Changes = append(pv.Changes, tool.Change{Field: "counts_in", After: countsIn(true)})
	}
}

func previewBudgetAmount(pv *tool.Preview, p budgetGoalPlan) error {
	latest, err := money.New(p.budget.Amounts[len(p.budget.Amounts)-1].Amount, p.budget.Currency)
	if err != nil {
		return err
	}

	pv.Target = p.categoryName
	pv.Changes = []tool.Change{
		{Field: "budget", After: tool.TextValue(p.categoryName)},
		{Field: "amount", Before: tool.MoneyValue(latest), After: tool.MoneyValue(*p.amount)},
		{Field: "date", After: tool.DateValue(p.month)},
	}

	return nil
}

func previewGoalUpdate(
	pv *tool.Preview,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
	accounts tool.Value,
) error {
	pv.Target = p.goal.Name
	if in.Name != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "name",
				Before: tool.TextValue(p.goal.Name),
				After:  tool.TextValue(in.Name),
			},
		)
	}

	if p.amount != nil {
		before, err := money.New(p.goal.Target, p.goal.Currency)
		if err != nil {
			return err
		}

		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "target",
				Before: tool.MoneyValue(before),
				After:  tool.MoneyValue(*p.amount),
			},
		)
	}

	if !in.DueOn.IsZero() {
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "due_on",
				Before: tool.DateValue(p.goal.DueOn),
				After:  tool.DateValue(in.DueOn.Time),
			},
		)
	}

	if len(p.accountIDs) > 0 {
		pv.Changes = append(pv.Changes, tool.Change{Field: "accounts", After: accounts})
	}

	if in.CountsAsSavings.Set {
		pv.Changes = append(pv.Changes, countsInChange(p.goal.CountsAsSavings, in))
	}

	return nil
}

func countsInChange(before bool, in manageBudgetOrGoalIn) tool.Change {
	return tool.Change{
		Field:  "counts_in",
		Before: countsIn(before),
		After:  countsIn(in.CountsAsSavings.B),
	}
}

// countsIn names the bucket that draws the deposits of a goal (income buckets A239).
func countsIn(savings bool) tool.Value {
	if savings {
		return tool.TextValue("the bucket that takes savings")
	}

	return tool.TextValue("the bucket that takes goals")
}

func previewPlanSave(pv *tool.Preview, in manageBudgetOrGoalIn, p budgetGoalPlan) error {
	pv.Target = p.month.Format(monthLayout)

	pv.Changes = []tool.Change{{Field: "date", After: tool.DateValue(p.month)}}
	if in.Source != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "source", After: tool.TextValue(string(in.Source))},
		)
	}

	if p.amount != nil {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "reference", After: tool.MoneyValue(*p.amount)},
		)
	}

	if in.SavingsTargetBP.Set {
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field: "rate",
				After: tool.TextValue(fmt.Sprintf("%d bp of the reference", in.SavingsTargetBP.N)),
			},
		)
	}

	planned := make(map[uuid.UUID]int64, len(p.plan.Rows))
	for _, r := range p.plan.Rows {
		planned[r.CategoryID] = r.Planned
	}

	for i, a := range p.planAmounts {
		before, err := money.New(planned[a.CategoryID], p.plan.Currency)
		if err != nil {
			return err
		}

		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "budget", After: tool.TextValue(p.planNames[i])},
			tool.Change{
				Field:  "amount",
				Before: tool.MoneyValue(before),
				After:  tool.MoneyValue(a.Amount),
			},
		)
	}

	return nil
}
