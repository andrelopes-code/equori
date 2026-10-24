package toolapi

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageBudgetOrGoalAction string

func (manageBudgetOrGoalAction) Values() []string {
	return []string{"create_budget", "set_budget_amount", "delete_budget", "create_goal", "update_goal", "delete_goal"}
}

type manageBudgetOrGoalIn struct {
	Action     manageBudgetOrGoalAction `json:"action" jsonschema:"operation to propose"`
	BudgetID   string                   `json:"budget_id,omitzero" jsonschema:"for set_budget_amount and delete_budget: budget from get_budgets_and_goals"`
	GoalID     string                   `json:"goal_id,omitzero" jsonschema:"for update_goal and delete_goal: goal from get_budgets_and_goals"`
	CategoryID string                   `json:"category_id,omitzero" jsonschema:"for create_budget: expense category from list_accounts"`
	Amount     string                   `json:"amount,omitzero" jsonschema:"for create_budget and set_budget_amount: positive monthly amount; for create_goal and update_goal: positive target"`
	Month      string                   `json:"month,omitzero" jsonschema:"for create_budget and set_budget_amount: first month the amount applies to; written YYYY-MM"`
	Rollover   bool                     `json:"rollover,omitzero" jsonschema:"for create_budget: the unspent amount carries to the next month"`
	Name       string                   `json:"name,omitzero" jsonschema:"for create_goal and update_goal: goal name"`
	DueOn      tool.Date                `json:"due_on,omitzero" jsonschema:"for create_goal and update_goal: date the target should be reached"`
	AccountIDs []string                 `json:"account_ids,omitzero" jsonschema:"for create_goal and update_goal: balance accounts whose value counts toward the goal"`
}

type manageBudgetOrGoalOut struct {
	BudgetID string `json:"budget_id,omitzero"`
	GoalID   string `json:"goal_id,omitzero"`
	Deleted  bool   `json:"deleted,omitzero"`
}

// budgetGoalPlan holds what a manage_budget_or_goal call reads and validates before it previews or writes.
type budgetGoalPlan struct {
	budgetID, goalID, categoryID uuid.UUID
	budget                       domain.Budget
	goal                         app.GoalView
	categoryName                 string
	month                        time.Time
	amount                       *money.Money
	accountIDs                   []uuid.UUID
	accountNames                 []string
}

func prepareBudgetOrGoal(ctx context.Context, svc *app.Service, l Ledger, userID int64, in manageBudgetOrGoalIn) (budgetGoalPlan, error) {
	fields := []field{
		{"budget_id", in.BudgetID != ""}, {"goal_id", in.GoalID != ""}, {"category_id", in.CategoryID != ""},
		{"amount", in.Amount != ""}, {"month", in.Month != ""}, {"rollover", in.Rollover}, {"name", in.Name != ""},
		{"due_on", !in.DueOn.IsZero()}, {"account_ids", len(in.AccountIDs) > 0},
	}
	name := string(in.Action)
	var err error
	switch in.Action {
	case "create_budget":
		err = required(name, fields, []string{"category_id", "amount", "month"}, "rollover")
	case "set_budget_amount":
		err = required(name, fields, []string{"budget_id", "amount", "month"})
	case "delete_budget":
		err = required(name, fields, []string{"budget_id"})
	case "create_goal":
		err = required(name, fields, []string{"name", "amount", "due_on", "account_ids"})
	case "update_goal":
		err = required(name, fields, []string{"goal_id"}, "name", "amount", "due_on", "account_ids")
	case "delete_goal":
		err = required(name, fields, []string{"goal_id"})
	}
	if err != nil {
		return budgetGoalPlan{}, err
	}
	var p budgetGoalPlan
	for _, id := range []struct {
		s, field string
		into     *uuid.UUID
	}{{in.BudgetID, "budget_id", &p.budgetID}, {in.GoalID, "goal_id", &p.goalID}, {in.CategoryID, "category_id", &p.categoryID}} {
		if *id.into, err = optionalID(id.s, id.field); err != nil {
			return budgetGoalPlan{}, err
		}
	}
	for _, s := range in.AccountIDs {
		id, err := optionalID(s, "account_ids")
		if err != nil {
			return budgetGoalPlan{}, err
		}
		p.accountIDs = append(p.accountIDs, id)
	}
	if p.month, err = parseMonth("month", in.Month, time.Time{}); err != nil {
		return budgetGoalPlan{}, err
	}
	accounts, err := l.Accounts(ctx, userID)
	if err != nil {
		return budgetGoalPlan{}, err
	}
	for _, id := range p.accountIDs {
		a, ok := accounts[id]
		if !ok {
			return budgetGoalPlan{}, validationError("account_ids", "must be balance accounts of the user")
		}
		p.accountNames = append(p.accountNames, a.Name)
	}
	var currency money.Currency
	switch in.Action {
	case "create_budget":
		a, ok := accounts[p.categoryID]
		if !ok {
			return budgetGoalPlan{}, validationError("category_id", "must be an income or expense category of the user")
		}
		p.categoryName = a.Name
		currency, err = l.BaseCurrency(ctx, userID)
	case "set_budget_amount", "delete_budget":
		if p.budget, err = svc.Budget(ctx, userID, p.budgetID); err == nil {
			p.categoryName, currency = accounts[p.budget.CategoryID].Name, p.budget.Currency
		}
	case "create_goal":
		currency, err = l.BaseCurrency(ctx, userID)
	case "update_goal", "delete_goal":
		if p.goal, err = svc.Goal(ctx, userID, p.goalID); err == nil {
			currency = p.goal.Currency
		}
	}
	if err != nil {
		return budgetGoalPlan{}, err
	}
	if in.Amount != "" {
		unit, err := unitOf(currency)
		if err != nil {
			return budgetGoalPlan{}, err
		}
		m, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return budgetGoalPlan{}, err
		}
		p.amount = &m
	}
	return p, nil
}

func manageBudgetOrGoal(svc *app.Service, l Ledger, _ clock.Clock) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_budget_or_goal",
		Description: "Proposes creating a monthly budget for a category, setting a budget's amount from a month on, deleting a budget, or creating, changing or deleting a goal. " +
			"Use it when the user sets a spending limit or a savings target. " +
			"Do not use it for recurring payments: manage_schedule does. " +
			"Deleting a budget or a goal cannot be undone; the user confirms every change.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, userID int64, in manageBudgetOrGoalIn) (tool.Preview, error) {
		p, err := prepareBudgetOrGoal(ctx, svc, l, userID, in)
		if err != nil {
			return tool.Preview{}, err
		}
		pv := tool.Preview{Action: "manage_budget_or_goal." + string(in.Action)}
		accounts := tool.TextValue(strings.Join(p.accountNames, ", "))
		switch in.Action {
		case "create_budget":
			pv.Target = "Budget " + p.categoryName
			pv.Changes = []tool.Change{
				{Field: "budget", After: tool.TextValue(p.categoryName)}, {Field: "amount", After: tool.MoneyValue(*p.amount)},
				{Field: "date", After: tool.DateValue(p.month)},
			}
		case "set_budget_amount":
			latest, err := money.New(p.budget.Amounts[len(p.budget.Amounts)-1].Amount, p.budget.Currency)
			if err != nil {
				return tool.Preview{}, err
			}
			pv.Target = "Budget " + p.categoryName
			pv.Changes = []tool.Change{
				{Field: "budget", After: tool.TextValue(p.categoryName)},
				{Field: "amount", Before: tool.MoneyValue(latest), After: tool.MoneyValue(*p.amount)},
				{Field: "date", After: tool.DateValue(p.month)},
			}
		case "delete_budget":
			pv.Target, pv.Destructive = "Budget "+p.categoryName, true
			pv.Changes = []tool.Change{{Field: "budget", Before: tool.TextValue(p.categoryName)}}
		case "create_goal":
			pv.Target = "Goal " + in.Name
			pv.Changes = []tool.Change{
				{Field: "goal", After: tool.TextValue(in.Name)}, {Field: "target", After: tool.MoneyValue(*p.amount)},
				{Field: "due_on", After: tool.DateValue(in.DueOn.Time)}, {Field: "accounts", After: accounts},
			}
		case "update_goal":
			pv.Target = "Goal " + p.goal.Name
			if in.Name != "" {
				pv.Changes = append(pv.Changes, tool.Change{Field: "name", Before: tool.TextValue(p.goal.Name), After: tool.TextValue(in.Name)})
			}
			if p.amount != nil {
				before, err := money.New(p.goal.Target, p.goal.Currency)
				if err != nil {
					return tool.Preview{}, err
				}
				pv.Changes = append(pv.Changes, tool.Change{Field: "target", Before: tool.MoneyValue(before), After: tool.MoneyValue(*p.amount)})
			}
			if !in.DueOn.IsZero() {
				pv.Changes = append(pv.Changes, tool.Change{Field: "due_on", Before: tool.DateValue(p.goal.DueOn), After: tool.DateValue(in.DueOn.Time)})
			}
			if len(p.accountIDs) > 0 {
				pv.Changes = append(pv.Changes, tool.Change{Field: "accounts", After: accounts})
			}
		case "delete_goal":
			pv.Target, pv.Destructive = "Goal "+p.goal.Name, true
			pv.Changes = []tool.Change{{Field: "goal", Before: tool.TextValue(p.goal.Name)}}
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in manageBudgetOrGoalIn) (manageBudgetOrGoalOut, error) {
		p, err := prepareBudgetOrGoal(ctx, svc, l, userID, in)
		if err != nil {
			return manageBudgetOrGoalOut{}, err
		}
		switch in.Action {
		case "create_budget":
			b, err := svc.CreateBudget(ctx, userID, p.categoryID, *p.amount, p.month, in.Rollover)
			return manageBudgetOrGoalOut{BudgetID: b.ID.String()}, err
		case "set_budget_amount":
			_, err := svc.AddBudgetAmount(ctx, userID, p.budgetID, p.month, *p.amount)
			return manageBudgetOrGoalOut{BudgetID: p.budgetID.String()}, err
		case "delete_budget":
			return manageBudgetOrGoalOut{BudgetID: p.budgetID.String(), Deleted: true}, svc.DeleteBudget(ctx, userID, p.budgetID)
		case "create_goal":
			g, err := svc.CreateGoal(ctx, userID, in.Name, *p.amount, in.DueOn.Time, p.accountIDs)
			return manageBudgetOrGoalOut{GoalID: g.ID.String()}, err
		case "update_goal":
			patch := app.GoalPatch{Target: p.amount}
			if in.Name != "" {
				patch.Name = &in.Name
			}
			if !in.DueOn.IsZero() {
				patch.DueOn = &in.DueOn.Time
			}
			if len(p.accountIDs) > 0 {
				patch.AccountIDs = &p.accountIDs
			}
			_, err := svc.UpdateGoal(ctx, userID, p.goalID, patch)
			return manageBudgetOrGoalOut{GoalID: p.goalID.String()}, err
		}
		return manageBudgetOrGoalOut{GoalID: p.goalID.String(), Deleted: true}, svc.DeleteGoal(ctx, userID, p.goalID)
	})
}
