package toolapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func prepareBudgetOrGoal(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	in manageBudgetOrGoalIn,
) (budgetGoalPlan, error) {
	if err := checkBudgetGoalFields(in); err != nil {
		return budgetGoalPlan{}, err
	}

	p, err := decodeBudgetGoalArguments(in)
	if err != nil {
		return budgetGoalPlan{}, err
	}

	accounts, err := l.Accounts(ctx, booksID)
	if err != nil {
		return budgetGoalPlan{}, err
	}

	if p.accountNames, err = balanceAccountNames(p.accountIDs, accounts); err != nil {
		return budgetGoalPlan{}, err
	}

	currency, err := resolveBudgetGoalCurrency(ctx, svc, l, booksID, in, &p, accounts)
	if err != nil {
		return budgetGoalPlan{}, err
	}

	if in.Amount != "" {
		parse := parseBudgetGoalAmount
		if in.Action == "allocate" {
			parse = parseAllocationAmount
		}

		if p.amount, err = parse(in.Amount, currency); err != nil {
			return budgetGoalPlan{}, err
		}
	}

	return p, nil
}

func decodeBudgetGoalArguments(in manageBudgetOrGoalIn) (budgetGoalPlan, error) {
	var (
		p   budgetGoalPlan
		err error
	)
	for _, id := range []struct {
		s, field string
		into     *uuid.UUID
	}{
		{in.BudgetID, "budget_id", &p.budgetID},
		{in.GoalID, "goal_id", &p.goalID},
		{in.CategoryID, "category_id", &p.categoryID},
		{in.TransactionID, "transaction_id", &p.txID},
	} {
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

	return p, nil
}

func balanceAccountNames(ids []uuid.UUID, accounts map[uuid.UUID]Account) ([]string, error) {
	var names []string

	for _, id := range ids {
		a, ok := accounts[id]
		if !ok {
			return nil, validationError("account_ids", "must be balance accounts of the book")
		}

		names = append(names, a.Name)
	}

	return names, nil
}

func resolveBudgetGoalCurrency(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	in manageBudgetOrGoalIn,
	p *budgetGoalPlan,
	accounts map[uuid.UUID]Account,
) (money.Currency, error) {
	var (
		currency money.Currency
		err      error
	)

	switch in.Action {
	case "create_budget":
		a, ok := accounts[p.categoryID]
		if !ok {
			return currency, validationError(
				"category_id",
				"must be an income or expense category of the book",
			)
		}

		p.categoryName = a.Name
		currency, err = l.BaseCurrency(ctx, booksID)
	case "set_budget_amount", "delete_budget":
		if p.budget, err = svc.Budget(ctx, booksID, p.budgetID); err == nil {
			p.categoryName, currency = accounts[p.budget.CategoryID].Name, p.budget.Currency
		}
	case "end_budget":
		return loadBudgetEnd(ctx, svc, booksID, p, accounts)
	case "create_goal":
		currency, err = l.BaseCurrency(ctx, booksID)
	case "save_plan":
		return loadBudgetPlan(ctx, svc, l, booksID, in, p, accounts)
	case "save_buckets":
		err = loadBuckets(ctx, svc, booksID, in.Buckets, accounts, p)
	case "move_category":
		p.categoryName = accounts[p.categoryID].Name
		p.move, err = svc.PlanCategoryMove(ctx, booksID, p.categoryID, in.Bucket)
		p.buckets = p.move.Buckets
	case "update_goal", "delete_goal":
		if p.goal, err = svc.Goal(ctx, booksID, p.goalID); err == nil {
			currency = p.goal.Currency
		}
	case "link_expense", "unlink_expense":
		err = loadGoalExpense(ctx, svc, l, booksID, p)
	case "allocate":
		return loadAllocation(ctx, svc, booksID, p, accounts)
	}

	return currency, err
}

func loadBudgetPlan(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	in manageBudgetOrGoalIn,
	p *budgetGoalPlan,
	accounts map[uuid.UUID]Account,
) (money.Currency, error) {
	currency, err := l.BaseCurrency(ctx, booksID)
	if err != nil {
		return currency, err
	}

	if p.plan, err = svc.BudgetPlan(ctx, booksID, p.month); err != nil {
		return currency, err
	}

	unit, err := unitOf(currency)
	if err != nil {
		return currency, err
	}

	err = decodePlanAmounts(in.Amounts, unit, accounts, p)

	return currency, err
}

func decodePlanAmounts(
	amounts []planAmountIn,
	unit money.Money,
	accounts map[uuid.UUID]Account,
	p *budgetGoalPlan,
) error {
	for i, a := range amounts {
		id, err := optionalID(a.CategoryID, fmt.Sprintf("amounts[%d].category_id", i))
		if err != nil {
			return err
		}

		m, err := tool.ParseAmount(fmt.Sprintf("amounts[%d].amount", i), a.Amount, unit)
		if err != nil {
			return err
		}

		p.planAmounts = append(p.planAmounts, app.PlanAmount{CategoryID: id, Amount: m})
		p.planNames = append(p.planNames, accounts[id].Name)
	}

	return nil
}

func parseBudgetGoalAmount(amount string, currency money.Currency) (*money.Money, error) {
	unit, err := unitOf(currency)
	if err != nil {
		return nil, err
	}

	m, err := tool.ParsePositive("amount", amount, unit)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

func manageBudgetOrGoal(svc *app.Service, l Ledger, _ clock.Clock) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_budget_or_goal",
		Description: "Proposes creating, changing, ending or deleting a monthly budget or a goal, saving a month's budget plan or the income split into buckets (50/30/20 and others), or moving one category to another bucket. " +
			"link_expense states that a goal paid an expense, which then counts against neither its budget nor its bucket. " +
			"allocate sets aside part of a shared account for a goal; a negative amount releases it. " +
			"Use it when the user sets a spending limit or a savings target. Do not use it for recurring payments: manage_schedule does. " +
			"Deleting cannot be undone; the user confirms every change.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, booksID int64, in manageBudgetOrGoalIn) (tool.Preview, error) {
		p, err := prepareBudgetOrGoal(ctx, svc, l, booksID, in)
		if err != nil {
			return tool.Preview{}, err
		}

		return previewBudgetOrGoal(in, p)
	}, func(ctx context.Context, booksID int64, in manageBudgetOrGoalIn) (manageBudgetOrGoalOut, error) {
		p, err := prepareBudgetOrGoal(ctx, svc, l, booksID, in)
		if err != nil {
			return manageBudgetOrGoalOut{}, err
		}

		return runBudgetOrGoal(ctx, svc, booksID, in, p)
	})
}

func runBudgetOrGoal(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
) (manageBudgetOrGoalOut, error) {
	switch in.Action {
	case "create_budget":
		b, err := svc.CreateBudget(ctx, booksID, p.categoryID, *p.amount, p.month, in.Rollover)
		return manageBudgetOrGoalOut{BudgetID: b.ID.String()}, err
	case "set_budget_amount":
		_, err := svc.AddBudgetAmount(ctx, booksID, p.budgetID, p.month, *p.amount)
		return manageBudgetOrGoalOut{BudgetID: p.budgetID.String()}, err
	case "delete_budget":
		out := manageBudgetOrGoalOut{BudgetID: p.budgetID.String(), Deleted: true}
		return out, svc.DeleteBudget(ctx, booksID, p.budgetID)
	case "end_budget":
		_, err := svc.EndBudget(ctx, booksID, p.budgetID, p.month)
		return manageBudgetOrGoalOut{BudgetID: p.budgetID.String()}, err
	case "create_goal":
		whole, allocated := goalAccountLists(in, p)
		g, err := svc.CreateGoal(
			ctx, booksID, in.Name, *p.amount, in.DueOn.Time, whole, allocated, in.CountsAsSavings.B,
		)

		return manageBudgetOrGoalOut{GoalID: g.ID.String()}, err
	case "allocate":
		_, err := svc.CreateGoalAllocation(ctx, booksID, p.goalID, p.accountIDs[0], *p.amount, nil)
		return manageBudgetOrGoalOut{GoalID: p.goalID.String()}, err
	case "save_plan":
		return savePlan(ctx, svc, booksID, in, p)
	case "save_buckets", "move_category":
		// move_category takes no month: its version starts in the current month (A237).
		var from *time.Time
		if !p.month.IsZero() {
			from = &p.month
		}

		return manageBudgetOrGoalOut{}, svc.SaveBudgetBuckets(ctx, booksID, from, p.buckets)
	case "update_goal":
		return updateGoal(ctx, svc, booksID, in, p)
	case "delete_bucket_version":
		return manageBudgetOrGoalOut{Deleted: true}, svc.DeleteBucketVersion(ctx, booksID, p.month)
	case "link_expense", "unlink_expense":
		return runGoalExpense(ctx, svc, booksID, in, p)
	}

	out := manageBudgetOrGoalOut{GoalID: p.goalID.String(), Deleted: true}

	return out, svc.DeleteGoal(ctx, booksID, p.goalID)
}

func savePlan(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
) (manageBudgetOrGoalOut, error) {
	source, fixed, target, err := planSaveArguments(in, p)
	if err != nil {
		return manageBudgetOrGoalOut{}, err
	}

	_, err = svc.SaveBudgetPlan(ctx, booksID, p.month, source, fixed, target, p.planAmounts)

	return manageBudgetOrGoalOut{}, err
}

func planSaveArguments(
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
) (domain.ReferenceSource, *money.Money, *int, error) {
	source, fixed := domain.ReferenceSource(in.Source), p.amount
	if source == "" {
		source = p.plan.Reference.Source
		if p.plan.Reference.HasFixed && fixed == nil {
			m, err := money.New(p.plan.Reference.Fixed, p.plan.Currency)
			if err != nil {
				return source, fixed, nil, err
			}

			fixed = &m
		}
	}

	var target *int

	switch {
	case in.SavingsTargetBP.Set:
		target = &in.SavingsTargetBP.N
	case p.plan.Reference.HasTarget:
		target = &p.plan.Reference.TargetBP
	}

	return source, fixed, target, nil
}

func updateGoal(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
) (manageBudgetOrGoalOut, error) {
	patch := app.GoalPatch{Target: p.amount}
	if in.Name != "" {
		patch.Name = &in.Name
	}

	if !in.DueOn.IsZero() {
		patch.DueOn = &in.DueOn.Time
	}

	if len(p.accountIDs) > 0 {
		whole, allocated := goalAccountLists(in, p)
		patch.AccountIDs, patch.AllocatedAccountIDs = &whole, &allocated
	}

	if in.CountsAsSavings.Set {
		patch.CountsAsSavings = &in.CountsAsSavings.B
	}

	_, err := svc.UpdateGoal(ctx, booksID, p.goalID, patch)

	return manageBudgetOrGoalOut{GoalID: p.goalID.String()}, err
}
