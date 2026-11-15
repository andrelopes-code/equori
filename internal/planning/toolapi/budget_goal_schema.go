package toolapi

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageBudgetOrGoalAction string

func (manageBudgetOrGoalAction) Values() []string {
	return []string{
		"create_budget",
		"set_budget_amount",
		"delete_budget",
		"create_goal",
		"update_goal",
		"delete_goal",
		"save_plan",
		"save_buckets",
	}
}

type planSource string

func (planSource) Values() []string {
	return []string{
		string(domain.SourceExpectedIncome),
		string(domain.SourceAverageIncome),
		string(domain.SourceFixed),
	}
}

type planAmountIn struct {
	CategoryID string `json:"category_id" jsonschema:"expense category from list_accounts"`
	Amount     string `json:"amount"      jsonschema:"monthly amount, zero or more"`
}

type manageBudgetOrGoalIn struct {
	Action          manageBudgetOrGoalAction `json:"action"                     jsonschema:"operation to propose"`
	BudgetID        string                   `json:"budget_id,omitzero"         jsonschema:"for set_budget_amount and delete_budget: budget from get_budgets_and_goals"`
	GoalID          string                   `json:"goal_id,omitzero"           jsonschema:"for update_goal and delete_goal: goal from get_budgets_and_goals"`
	CategoryID      string                   `json:"category_id,omitzero"       jsonschema:"for create_budget: expense category from list_accounts"`
	Amount          string                   `json:"amount,omitzero"            jsonschema:"positive monthly amount (budgets), target (goals) or fixed reference income (save_plan)"`
	Month           string                   `json:"month,omitzero"             jsonschema:"first month the amount applies to, YYYY-MM"`
	Source          planSource               `json:"source,omitzero"            jsonschema:"for save_plan: reference income of the plan; the stored one when absent"`
	SavingsTargetBP tool.OptionalInt         `json:"savings_target_bp,omitzero" jsonschema:"for save_plan: share of the reference to save, in basis points from 0 to 10000; the stored one when absent"`
	Amounts         []planAmountIn           `json:"amounts,omitzero"           jsonschema:"for save_plan: the categories whose amount changes from month on"`
	Rollover        bool                     `json:"rollover,omitzero"          jsonschema:"for create_budget: the unspent amount carries to the next month"`
	Name            string                   `json:"name,omitzero"              jsonschema:"for create_goal and update_goal: goal name"`
	DueOn           tool.Date                `json:"due_on,omitzero"            jsonschema:"for create_goal and update_goal: date the target should be reached"`
	AccountIDs      []string                 `json:"account_ids,omitzero"       jsonschema:"for create_goal and update_goal: balance accounts whose value counts toward the goal"`
	Buckets         []bucketIn               `json:"buckets,omitzero"           jsonschema:"for save_buckets: the whole split"`
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
	plan                         app.Plan
	planAmounts                  []app.PlanAmount
	planNames                    []string
	buckets                      []domain.Bucket
	bucketNames                  [][]string
}
