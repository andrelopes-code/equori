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
