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
		"move_category",
		"link_expense",
		"unlink_expense",
		"allocate",
		"delete_bucket_version",
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
	Amount     string `json:"amount"      jsonschema:"zero or more"`
}

type manageBudgetOrGoalIn struct {
	Action          manageBudgetOrGoalAction `json:"action"                     jsonschema:"operation to propose"`
	BudgetID        string                   `json:"budget_id,omitzero"         jsonschema:"budget from get_budgets_and_goals"`
	GoalID          string                   `json:"goal_id,omitzero"           jsonschema:"goal from get_budgets_and_goals"`
	TransactionID   string                   `json:"transaction_id,omitzero"    jsonschema:"the expense transaction"`
	CategoryID      string                   `json:"category_id,omitzero"       jsonschema:"expense category from list_accounts"`
	Amount          string                   `json:"amount,omitzero"            jsonschema:"positive monthly amount (budgets), target (goals) or fixed reference income (save_plan)"`
	Month           string                   `json:"month,omitzero"             jsonschema:"first month it applies, YYYY-MM"`
	Source          planSource               `json:"source,omitzero"            jsonschema:"for save_plan: reference income; the stored one when absent"`
	SavingsTargetBP tool.OptionalInt         `json:"savings_target_bp,omitzero" jsonschema:"for save_plan: share of the reference to save, in bp; the stored one when absent"`
	Amounts         []planAmountIn           `json:"amounts,omitzero"           jsonschema:"for save_plan: categories whose amount changes from month on"`
	Rollover        bool                     `json:"rollover,omitzero"          jsonschema:"for create_budget: unspent amount carries over"`
	Name            string                   `json:"name,omitzero"              jsonschema:"goals: name"`
	DueOn           tool.Date                `json:"due_on,omitzero"            jsonschema:"goals: target date"`
	AccountIDs      []string                 `json:"account_ids,omitzero"       jsonschema:"goals: accounts whose balance counts toward it"`
	CountsAsSavings tool.OptionalBool        `json:"counts_as_savings,omitzero" jsonschema:"goals: deposits count in the savings bucket"`
	Allocated       bool                     `json:"allocated,omitzero"         jsonschema:"goals: account_ids are shared, held by amount"`
	Buckets         []bucketIn               `json:"buckets,omitzero"           jsonschema:"for save_buckets: whole split; empty removes it"`
	Bucket          string                   `json:"bucket,omitzero"            jsonschema:"for move_category: bucket name of the current split, or none"`
}

type manageBudgetOrGoalOut struct {
	BudgetID string `json:"budget_id,omitzero"`
	GoalID   string `json:"goal_id,omitzero"`
	Deleted  bool   `json:"deleted,omitzero"`
}

// budgetGoalPlan holds what a manage_budget_or_goal call reads and validates before it previews or writes.
type budgetGoalPlan struct {
	budgetID, goalID, categoryID uuid.UUID
	txID                         uuid.UUID
	tx                           Transaction
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
	storedNames                  []string
	outsideNames                 []string
	move                         app.CategoryMove
}
