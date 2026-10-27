package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type planView struct {
	Month          string `json:"month"`
	Currency       string `json:"currency"`
	Source         string `json:"source"`
	Fixed          *money `json:"fixed"`
	ExpectedIncome *money `json:"expected_income"`
	ExpectedItems  []struct {
		ScheduleID  string `json:"schedule_id"`
		Description string `json:"description"`
		Amount      money  `json:"amount"`
	} `json:"expected_items"`
	AverageIncome  *money `json:"average_income"`
	AverageMonths  int    `json:"average_months"`
	ReceivedIncome money  `json:"received_income"`
	Reference      *money `json:"reference"`
	Installments   money  `json:"installments"`
	Savings        money  `json:"savings"`
	Planned        money  `json:"planned"`
	Unassigned     *money `json:"unassigned"`
	Rows           []struct {
		CategoryID string `json:"category_id"`
		BudgetID   string `json:"budget_id"`
		Planned    money  `json:"planned"`
		LastMonth  money  `json:"last_month"`
		Average    money  `json:"average"`
		Counted    bool   `json:"counted"`
		NextChange string `json:"next_change"`
	} `json:"rows"`
}

func (f fixture) plan(month string) planView {
	f.h.T().Helper()
	var out planView
	f.h.MustDo(http.MethodGet, "/api/v1/budget-plan?month="+month, nil, http.StatusOK, &out)
	return out
}

func amountOf(m *money) int64 {
	if m == nil {
		return -1
	}
	return m.Amount
}

// S158: the plan subtracts installments of earlier purchases and savings, not bills.
func TestS158PlanFigures(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-02")
	card := f.h.Card("Visa", 3, 10, "next")
	electronics := f.h.Account("Electronics", "expense", "", nil)
	purchase := func(date string, amount int64, count int) {
		f.h.MustDo(http.MethodPost, "/api/v1/installment-purchases", map[string]any{
			"card_account_id": card, "date": date, "description": "Purchase",
			"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(amount)}}, "installment_count": count,
		}, http.StatusCreated, nil)
	}
	purchase("2026-10-20", 90000, 3)
	purchase("2026-12-02", 40000, 2)
	f.schedule("income", f.checking, f.salary, 720000, monthly("2026-12-01", 5, ""), map[string]any{"description": "Salary"})
	f.schedule("income", f.checking, f.salary, 130000, monthly("2026-12-01", 20, ""), map[string]any{"description": "Freelance"})
	f.schedule("savings", f.checking, f.savings, 50000, monthly("2026-12-01", 10, ""), nil)
	f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-12-01", 15, ""), nil)
	f.budget(f.rent, 210000, "2026-12", false)

	var committed struct {
		Installments money `json:"installments"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/commitments?month=2026-12", nil, http.StatusOK, &committed)
	if committed.Installments.Amount != 50000 {
		t.Fatalf("committed installments = %d, want both purchases' 50000", committed.Installments.Amount)
	}
	got := f.plan("2026-12")
	if got.Month != "2026-12" || got.Currency != "BRL" || got.Source != "expected_income" {
		t.Fatalf("plan = %+v", got)
	}
	if amountOf(got.ExpectedIncome) != 850000 || len(got.ExpectedItems) != 2 || amountOf(got.Reference) != 850000 {
		t.Errorf("expected income = %d items %+v reference %d", amountOf(got.ExpectedIncome), got.ExpectedItems, amountOf(got.Reference))
	}
	if got.Installments.Amount != 30000 || got.Savings.Amount != 50000 || got.Planned.Amount != 210000 {
		t.Errorf("installments %d savings %d planned %d, want 30000 50000 210000", got.Installments.Amount, got.Savings.Amount, got.Planned.Amount)
	}
	if amountOf(got.Unassigned) != 850000-30000-50000-210000 {
		t.Errorf("unassigned = %d, want 560000", amountOf(got.Unassigned))
	}
}

// S159: the average income divides by the months of history, at most three.
func TestS159AverageIncome(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		dates   []string
		average int64
		months  int
	}{
		{"three months", []string{"2026-09-05", "2026-10-05", "2026-11-05"}, 600000, 3},
		{"one month", []string{"2026-11-05"}, 600000, 1},
		{"no history", nil, -1, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, "2026-12-01")
			for _, d := range tt.dates {
				f.h.Record(d, apitest.Posting(f.checking, 600000), apitest.Posting(f.salary, -600000))
			}
			got := f.plan("2026-12")
			if amountOf(got.AverageIncome) != tt.average || got.AverageMonths != tt.months {
				t.Fatalf("average = %d over %d months, want %d over %d", amountOf(got.AverageIncome), got.AverageMonths, tt.average, tt.months)
			}
		})
	}
}

// S160: a budget under a budgeted category is not counted again.
func TestS160NestedBudgets(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	food := f.h.Account("Food", "expense", "", nil)
	market := f.h.Account("Supermarket", "expense", "", map[string]any{"parent_id": food})
	f.budget(food, 180000, "2026-11", false)
	f.budget(market, 100000, "2026-11", false)
	got := f.plan("2026-11")
	if got.Planned.Amount != 180000 || len(got.Rows) != 2 {
		t.Fatalf("planned = %d rows %+v", got.Planned.Amount, got.Rows)
	}
	for _, r := range got.Rows {
		if r.Counted != (r.CategoryID == food) {
			t.Errorf("row %s counted = %v", r.CategoryID, r.Counted)
		}
	}
}

// S164: without a stored choice the source is the first one with a figure.
func TestS164ReferenceDefault(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	empty := f.plan("2026-12")
	if empty.Source != "fixed" || empty.Reference != nil || empty.Unassigned != nil || empty.Fixed != nil {
		t.Fatalf("plan without history = %+v", empty)
	}
	f.h.Record("2026-11-05", apitest.Posting(f.checking, 600000), apitest.Posting(f.salary, -600000))
	if got := f.plan("2026-12"); got.Source != "average_income" || amountOf(got.Reference) != 600000 || amountOf(got.Unassigned) != 600000 {
		t.Fatalf("plan with history = %+v", got)
	}
}

func TestBudgetPlanMonthBounds(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	for _, m := range []string{"2027-12", "2026-13"} {
		f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/budget-plan?month="+m, nil), http.StatusUnprocessableEntity, "validation_failed", "month")
	}
}

func (f fixture) savePlan(month string, body map[string]any) planView {
	f.h.T().Helper()
	var out planView
	f.h.MustDo(http.MethodPut, "/api/v1/budget-plan?month="+month, body, http.StatusOK, &out)
	return out
}

func amounts(pairs ...any) []map[string]any {
	out := make([]map[string]any, 0, len(pairs)/2)
	for i := 0; i < len(pairs); i += 2 {
		out = append(out, map[string]any{"category_id": pairs[i], "amount": pairs[i+1]})
	}
	return out
}

type budgetAmounts struct {
	Amounts []struct {
		EffectiveFrom string `json:"effective_from"`
		Amount        money  `json:"amount"`
	} `json:"amounts"`
}

func (f fixture) budgetAmounts(id string) budgetAmounts {
	f.h.T().Helper()
	var out budgetAmounts
	f.h.MustDo(http.MethodGet, "/api/v1/budgets/"+id, nil, http.StatusOK, &out)
	return out
}

// S161: a plan save replaces the amount of its month and keeps the later versions.
func TestS161SaveReplacesVersion(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	id := f.budget(food, 180000, "2026-11", false)
	f.h.MustDo(http.MethodPost, "/api/v1/budgets/"+id+"/amounts", map[string]any{"effective_from": "2027-01", "amount": apitest.BRL(200000)}, http.StatusCreated, nil)
	body := map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(150000))}
	for range 2 {
		got := f.savePlan("2026-11", body)
		if len(got.Rows) != 1 || got.Rows[0].Planned.Amount != 150000 || got.Rows[0].NextChange != "2027-01" || got.Planned.Amount != 150000 {
			t.Fatalf("plan = %+v", got)
		}
		b := f.budgetAmounts(id)
		if len(b.Amounts) != 2 || b.Amounts[0].EffectiveFrom != "2026-11" || b.Amounts[0].Amount.Amount != 150000 ||
			b.Amounts[1].EffectiveFrom != "2027-01" || b.Amounts[1].Amount.Amount != 200000 {
			t.Fatalf("amounts = %+v", b.Amounts)
		}
	}
	// A month between two versions gets its own.
	f.savePlan("2026-12", map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(160000))})
	if b := f.budgetAmounts(id); len(b.Amounts) != 3 || b.Amounts[1].EffectiveFrom != "2026-12" || b.Amounts[1].Amount.Amount != 160000 {
		t.Fatalf("amounts = %+v", b.Amounts)
	}
}

type budgetList struct {
	Items []struct {
		ID         string `json:"id"`
		CategoryID string `json:"category_id"`
		Rollover   bool   `json:"rollover"`
		Amounts    []struct {
			EffectiveFrom string `json:"effective_from"`
			Amount        money  `json:"amount"`
		} `json:"amounts"`
	} `json:"items"`
}

func (f fixture) budgetList() budgetList {
	f.h.T().Helper()
	var out budgetList
	f.h.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &out)
	return out
}

// S162: a plan save creates the budget of a category without one, unless its amount is zero.
func TestS162SaveCreatesBudget(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	pets := f.h.Account("Pets", "expense", "", nil)
	gifts := f.h.Account("Gifts", "expense", "", nil)
	f.savePlan("2026-11", map[string]any{"source": "average_income", "amounts": amounts(pets, apitest.BRL(21000), gifts, apitest.BRL(0))})
	got := f.budgetList()
	if len(got.Items) != 1 {
		t.Fatalf("budgets = %+v", got.Items)
	}
	b := got.Items[0]
	if b.CategoryID != pets || b.Rollover || len(b.Amounts) != 1 || b.Amounts[0].EffectiveFrom != "2026-11" || b.Amounts[0].Amount.Amount != 21000 {
		t.Fatalf("budget = %+v", b)
	}
}

// S163: a plan save is checked as a whole before anything is written.
func TestS163SaveErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	old := f.h.Account("Old", "expense", "", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+old+"/close", map[string]string{"closed_on": "2026-11-01"}, http.StatusOK, nil)
	id := f.budget(food, 180000, "2026-11", false)
	other := f.h.Login("other@example.com")
	var foreign struct {
		ID string `json:"id"`
	}
	r := f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Theirs", "class": "expense", "currency": "BRL"})
	if r.Status != http.StatusCreated {
		t.Fatalf("other category: %d %s", r.Status, r.Body)
	}
	r.Decode(t, &foreign)
	usd := map[string]any{"amount": 100, "currency": "USD"}
	tests := []struct {
		name, month, field string
		body               map[string]any
	}{
		{"past month", "2026-10", "month", map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(1))}},
		{"category twice", "2026-11", "amounts[1].category_id", map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(1), food, apitest.BRL(2))}},
		{"another user's category", "2026-11", "amounts[0].category_id", map[string]any{"source": "average_income", "amounts": amounts(foreign.ID, apitest.BRL(1))}},
		{"income category", "2026-11", "amounts[0].category_id", map[string]any{"source": "average_income", "amounts": amounts(f.salary, apitest.BRL(1))}},
		{"closed category", "2026-11", "amounts[0].category_id", map[string]any{"source": "average_income", "amounts": amounts(old, apitest.BRL(1))}},
		{"negative amount", "2026-11", "amounts[0].amount", map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(-1))}},
		{"other currency", "2026-11", "amounts[0].amount.currency", map[string]any{"source": "average_income", "amounts": amounts(food, usd)}},
		{"fixed without an amount", "2026-11", "fixed", map[string]any{"source": "fixed", "amounts": amounts(food, apitest.BRL(1))}},
		{"fixed in another currency", "2026-11", "fixed.currency", map[string]any{"source": "fixed", "fixed": usd, "amounts": amounts(food, apitest.BRL(1))}},
		{"negative fixed", "2026-11", "fixed", map[string]any{"source": "fixed", "fixed": apitest.BRL(-1), "amounts": amounts(food, apitest.BRL(1))}},
	}
	for _, tt := range tests {
		t.Log(tt.name)
		f.h.ExpectProblem(f.h.Do(http.MethodPut, "/api/v1/budget-plan?month="+tt.month, tt.body), http.StatusUnprocessableEntity, "validation_failed", tt.field)
	}
	if b := f.budgetAmounts(id); len(b.Amounts) != 1 || b.Amounts[0].Amount.Amount != 180000 {
		t.Errorf("amounts after errors = %+v", b.Amounts)
	}
	if got := f.budgetList(); len(got.Items) != 1 {
		t.Errorf("budgets after errors = %+v", got.Items)
	}
	if got := f.plan("2026-11"); got.Source != "fixed" {
		t.Errorf("source after errors = %s", got.Source)
	}
}

// S164: the reference choice is stored with the plan.
func TestS164ReferenceRoundTrip(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	got := f.savePlan("2026-11", map[string]any{"source": "fixed", "fixed": apitest.BRL(600000), "amounts": []map[string]any{}})
	if got.Source != "fixed" || amountOf(got.Fixed) != 600000 || amountOf(got.Reference) != 600000 || amountOf(got.Unassigned) != 600000 {
		t.Fatalf("plan = %+v", got)
	}
	if again := f.plan("2026-12"); again.Source != "fixed" || amountOf(again.Reference) != 600000 {
		t.Fatalf("next month = %+v", again)
	}
}

func TestSavePlanListsOnlyItsCategories(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	health := f.h.Account("Health", "expense", "", nil)
	f.budget(food, 180000, "2026-11", false)
	hid := f.budget(health, 48000, "2026-11", false)
	f.savePlan("2026-11", map[string]any{"source": "average_income", "amounts": amounts(food, apitest.BRL(150000))})
	if b := f.budgetAmounts(hid); len(b.Amounts) != 1 || b.Amounts[0].Amount.Amount != 48000 {
		t.Fatalf("health amounts = %+v", b.Amounts)
	}
}
