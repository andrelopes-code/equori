package planning_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolBudgetsAndGoals struct {
	Month   string `json:"month"`
	Budgets []struct {
		BudgetID     string    `json:"budget_id"`
		CategoryName string    `json:"category_name"`
		Planned      toolMoney `json:"planned"`
		Carried      toolMoney `json:"carried"`
		Spent        toolMoney `json:"spent"`
		Available    toolMoney `json:"available"`
		Rollover     bool      `json:"rollover"`
	} `json:"budgets"`
	Goals []struct {
		GoalID     string    `json:"goal_id"`
		Name       string    `json:"name"`
		Target     toolMoney `json:"target"`
		Current    toolMoney `json:"current"`
		Remaining  toolMoney `json:"remaining"`
		ProgressBP int       `json:"progress_bp"`
		DueOn      string    `json:"due_on"`
	} `json:"goals"`
}

type toolManaged struct {
	BudgetID string `json:"budget_id"`
	GoalID   string `json:"goal_id"`
	Deleted  bool   `json:"deleted"`
}

// S60 through the assistant: a budget with rollover and a new amount from December.
func TestManageBudgetAndProgress(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-10", apitest.Posting(f.checking, -150000), apitest.Posting(food, 150000))
	f.h.Record("2026-11-10", apitest.Posting(f.checking, -230000), apitest.Posting(food, 230000))
	args := map[string]any{"action": "create_budget", "category_id": food, "amount": "1800.00", "month": "2026-10", "rollover": true}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_budget_or_goal.create_budget", Target: "Budget Food", Changes: []tool.Change{
		{Field: "budget", After: tool.TextValue("Food")},
		{Field: "amount", After: tool.Value{Amount: "1800.00", Currency: "BRL"}},
		{Field: "date", After: tool.Value{Date: "2026-10-01"}},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	var got toolBudgetsAndGoals
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"month": "2026-11"}, &got)
	if len(got.Budgets) != 0 {
		t.Fatalf("budgets after the preview = %+v", got.Budgets)
	}

	var created toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", args, &created)
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", args), "budget_exists", "")
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"month": "2026-11", "kind": "budgets"}, &got)
	if got.Month != "2026-11" || len(got.Budgets) != 1 || len(got.Goals) != 0 {
		t.Fatalf("budgets = %+v", got)
	}
	b := got.Budgets[0]
	if b.BudgetID != created.BudgetID || b.CategoryName != "Food" || !b.Rollover || b.Planned != (toolMoney{"1800.00", "BRL"}) ||
		b.Carried != (toolMoney{"300.00", "BRL"}) || b.Spent != (toolMoney{"2300.00", "BRL"}) || b.Available != (toolMoney{"-200.00", "BRL"}) {
		t.Errorf("budget = %+v", b)
	}

	set := map[string]any{"action": "set_budget_amount", "budget_id": created.BudgetID, "amount": "2000.00", "month": "2026-12"}
	p, _ = preview(t, f.h, "manage_budget_or_goal", set)
	if p.Target != "Budget Food" || len(p.Changes) != 3 || p.Changes[1].Before.Amount != "1800.00" || p.Changes[1].After.Amount != "2000.00" {
		t.Errorf("preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_budget_or_goal", set, &created)
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"month": "2026-12"}, &got)
	if b := got.Budgets[0]; b.Planned.Amount != "2000.00" || b.Carried.Amount != "-200.00" || b.Spent.Amount != "0.00" || b.Available.Amount != "1800.00" {
		t.Errorf("december = %+v", b)
	}
}

// S61 and S120 through the assistant: create, update and delete a goal.
func TestManageGoal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-10-31", apitest.Posting(f.checking, -1008341), apitest.Posting(f.savings, 1008341))
	create := map[string]any{"action": "create_goal", "name": "Emergency", "amount": "30000.00", "due_on": "2027-06-30", "account_ids": []string{f.savings}}

	p, r := preview(t, f.h, "manage_budget_or_goal", create)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_budget_or_goal.create_goal", Target: "Goal Emergency", Changes: []tool.Change{
		{Field: "goal", After: tool.TextValue("Emergency")},
		{Field: "target", After: tool.Value{Amount: "30000.00", Currency: "BRL"}},
		{Field: "due_on", After: tool.Value{Date: "2027-06-30"}},
		{Field: "accounts", After: tool.TextValue("Emergency fund")},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	var got toolBudgetsAndGoals
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{}, &got)
	if len(got.Goals) != 0 {
		t.Fatalf("goals after the preview = %+v", got.Goals)
	}

	var created toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", create, &created)
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"kind": "goals"}, &got)
	if len(got.Goals) != 1 || got.Month != "2026-11" || len(got.Budgets) != 0 {
		t.Fatalf("goals = %+v", got)
	}
	g := got.Goals[0]
	if g.GoalID != created.GoalID || g.Name != "Emergency" || g.DueOn != "2027-06-30" || g.Target != (toolMoney{"30000.00", "BRL"}) ||
		g.Current != (toolMoney{"10083.41", "BRL"}) || g.Remaining != (toolMoney{"19916.59", "BRL"}) || g.ProgressBP != 3361 {
		t.Errorf("goal = %+v", g)
	}

	update := map[string]any{"action": "update_goal", "goal_id": created.GoalID, "amount": "40000.00"}
	p, _ = preview(t, f.h, "manage_budget_or_goal", update)
	wantChanges := []tool.Change{{Field: "target", Before: tool.Value{Amount: "30000.00", Currency: "BRL"}, After: tool.Value{Amount: "40000.00", Currency: "BRL"}}}
	if p.Target != "Goal Emergency" || !reflect.DeepEqual(p.Changes, wantChanges) || p.Destructive {
		t.Errorf("update preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_budget_or_goal", update, &created)
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"kind": "goals"}, &got)
	if got.Goals[0].Target.Amount != "40000.00" || got.Goals[0].ProgressBP != 2520 {
		t.Errorf("updated goal = %+v", got.Goals[0])
	}

	del := map[string]any{"action": "delete_goal", "goal_id": created.GoalID}
	p, _ = preview(t, f.h, "manage_budget_or_goal", del)
	if p.Target != "Goal Emergency" || !p.Destructive || !reflect.DeepEqual(p.Changes, []tool.Change{{Field: "goal", Before: tool.TextValue("Emergency")}}) {
		t.Errorf("delete preview = %+v", p)
	}
	var deleted toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", del, &deleted)
	if !deleted.Deleted {
		t.Errorf("delete = %+v", deleted)
	}
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", del), "not_found", "")
}

// S144 through the assistant: a budget is deleted after a destructive preview.
func TestManageBudgetDelete(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	id := f.budget(food, 180000, "2026-10", false)
	del := map[string]any{"action": "delete_budget", "budget_id": id}
	p, _ := preview(t, f.h, "manage_budget_or_goal", del)
	if p.Target != "Budget Food" || !p.Destructive || !reflect.DeepEqual(p.Changes, []tool.Change{{Field: "budget", Before: tool.TextValue("Food")}}) {
		t.Errorf("delete preview = %+v", p)
	}
	var deleted toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", del, &deleted)
	if !deleted.Deleted || deleted.BudgetID != id {
		t.Errorf("delete = %+v", deleted)
	}
	if list := f.budgets(); len(list.Items) != 0 {
		t.Errorf("budgets after delete = %+v", list.Items)
	}
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", del), "not_found", "")
}

func TestManageBudgetOrGoalInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	tests := []struct {
		name  string
		args  map[string]any
		field string
	}{
		{"create_budget without month", map[string]any{"action": "create_budget", "category_id": food, "amount": "10.00"}, "month"},
		{"create_budget with bad month", map[string]any{"action": "create_budget", "category_id": food, "amount": "10.00", "month": "2026-13"}, "month"},
		{"create_budget with goal_id", map[string]any{"action": "create_budget", "category_id": food, "amount": "10.00", "month": "2026-10", "goal_id": food}, "goal_id"},
		{"create_budget with a zero amount", map[string]any{"action": "create_budget", "category_id": food, "amount": "0.00", "month": "2026-10"}, "amount"},
		{"create_goal without name", map[string]any{"action": "create_goal", "amount": "10.00", "due_on": "2027-01-01", "account_ids": []string{f.savings}}, "name"},
		{"create_goal with a bad account", map[string]any{"action": "create_goal", "name": "G", "amount": "10.00", "due_on": "2027-01-01", "account_ids": []string{"x"}}, "account_ids"},
		{"delete_goal without goal_id", map[string]any{"action": "delete_goal"}, "goal_id"},
		{"delete_goal with name", map[string]any{"action": "delete_goal", "goal_id": food, "name": "G"}, "name"},
		{"delete_budget without budget_id", map[string]any{"action": "delete_budget"}, "budget_id"},
		{"delete_budget with amount", map[string]any{"action": "delete_budget", "budget_id": food, "amount": "10.00"}, "amount"},
		{"set_budget_amount with a bad id", map[string]any{"action": "set_budget_amount", "budget_id": "x", "amount": "10.00", "month": "2026-12"}, "budget_id"},
	}
	for _, tt := range tests {
		f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", tt.args), "invalid_arguments", tt.field)
		_, r := preview(t, f.h, "manage_budget_or_goal", tt.args)
		f.h.ExpectToolError(r, "invalid_arguments", tt.field)
	}
	f.h.ExpectToolError(f.h.Tool("get_budgets_and_goals", map[string]any{"month": "2026-13"}), "invalid_arguments", "month")
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", map[string]any{"action": "create_budget", "category_id": f.checking, "amount": "10.00", "month": "2026-10"}), "validation_failed", "category_id")
}

func TestBudgetAndGoalToolsOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	other := f.h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	var cat, acct, budget, goal struct {
		ID string `json:"id"`
	}
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Their food", "class": "expense", "currency": "BRL"}).Decode(t, &cat)
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Their savings", "class": "asset", "kind": "savings", "currency": "BRL"}).Decode(t, &acct)
	f.h.Call(other, http.MethodPost, "/api/v1/budgets", map[string]any{"category_id": cat.ID, "amount": apitest.BRL(1000), "effective_from": "2026-10", "rollover": false}).Decode(t, &budget)
	f.h.Call(other, http.MethodPost, "/api/v1/goals", map[string]any{"name": "Theirs", "target": apitest.BRL(1000), "due_on": "2027-06-30", "account_ids": []string{acct.ID}}).Decode(t, &goal)

	var got toolBudgetsAndGoals
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"month": "2026-11"}, &got)
	if len(got.Budgets) != 0 || len(got.Goals) != 0 {
		t.Errorf("owner reads %+v", got)
	}
	for _, args := range []map[string]any{
		{"action": "set_budget_amount", "budget_id": budget.ID, "amount": "10.00", "month": "2026-12"},
		{"action": "update_goal", "goal_id": goal.ID, "name": "Mine"},
		{"action": "delete_goal", "goal_id": goal.ID},
	} {
		f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", args), "not_found", "")
		_, r := preview(t, f.h, "manage_budget_or_goal", args)
		f.h.ExpectToolError(r, "not_found", "")
	}
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", map[string]any{"action": "create_budget", "category_id": cat.ID, "amount": "10.00", "month": "2026-10"}), "validation_failed", "category_id")
}

// S165: the plan of a month through the assistant matches the HTTP figures.
func TestS165PlanTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	f.h.Record("2026-11-05", apitest.Posting(f.checking, 600000), apitest.Posting(f.salary, -600000))
	f.budget(f.rent, 210000, "2026-12", false)
	var got struct {
		Month string `json:"month"`
		Plan  struct {
			Source     string    `json:"source"`
			Reference  toolMoney `json:"reference"`
			Planned    toolMoney `json:"planned"`
			Unassigned toolMoney `json:"unassigned"`
			Rows       []struct {
				CategoryName string    `json:"category_name"`
				Planned      toolMoney `json:"planned"`
				Counted      bool      `json:"counted"`
			} `json:"rows"`
		} `json:"plan"`
	}
	toolOutput(t, f.h, "get_budgets_and_goals", map[string]any{"month": "2026-12", "kind": "plan"}, &got)
	http := f.plan("2026-12")
	if got.Month != "2026-12" || got.Plan.Source != http.Source || got.Plan.Reference != (toolMoney{"6000.00", "BRL"}) ||
		got.Plan.Planned != (toolMoney{"2100.00", "BRL"}) || got.Plan.Unassigned != (toolMoney{"3900.00", "BRL"}) || amountOf(http.Unassigned) != 390000 {
		t.Fatalf("plan = %+v, http %+v", got, http)
	}
	if len(got.Plan.Rows) != 1 || got.Plan.Rows[0].CategoryName != "Rent" || !got.Plan.Rows[0].Counted {
		t.Errorf("rows = %+v", got.Plan.Rows)
	}
}

// S166: saving a plan through the assistant is previewed before it writes.
func TestS166SavePlanTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	f.budget(food, 180000, "2026-11", false)
	args := map[string]any{"action": "save_plan", "month": "2026-11", "source": "fixed", "amount": "8500.00",
		"amounts": []map[string]any{{"category_id": food, "amount": "1500.00"}, {"category_id": f.rent, "amount": "2100.00"}}}
	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_budget_or_goal.save_plan", Target: "Budget plan 2026-11", Changes: []tool.Change{
		{Field: "date", After: tool.Value{Date: "2026-11-01"}},
		{Field: "source", After: tool.TextValue("fixed")},
		{Field: "reference", After: tool.Value{Amount: "8500.00", Currency: "BRL"}},
		{Field: "budget", After: tool.TextValue("Food")},
		{Field: "amount", Before: tool.Value{Amount: "1800.00", Currency: "BRL"}, After: tool.Value{Amount: "1500.00", Currency: "BRL"}},
		{Field: "budget", After: tool.TextValue("Rent")},
		{Field: "amount", Before: tool.Value{Amount: "0.00", Currency: "BRL"}, After: tool.Value{Amount: "2100.00", Currency: "BRL"}},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	if got := f.plan("2026-11"); got.Planned.Amount != 180000 || got.Source != "fixed" || got.Reference != nil {
		t.Fatalf("plan after the preview = %+v", got)
	}
	var out toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", args, &out)
	if got := f.plan("2026-11"); got.Planned.Amount != 360000 || amountOf(got.Reference) != 850000 || amountOf(got.Unassigned) != 490000 {
		t.Fatalf("plan after the save = %+v", got)
	}
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", map[string]any{"action": "save_plan", "month": "2026-11"}), "invalid_arguments", "amounts")
}
