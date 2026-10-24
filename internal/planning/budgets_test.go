package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type progressView struct {
	Month   string `json:"month"`
	Planned struct {
		Amount int64 `json:"amount"`
	} `json:"planned"`
	Carried struct {
		Amount int64 `json:"amount"`
	} `json:"carried"`
	Spent struct {
		Amount int64 `json:"amount"`
	} `json:"spent"`
	Available struct {
		Amount int64 `json:"amount"`
	} `json:"available"`
}

func (f fixture) budget(category string, amount int64, from string, rollover bool) string {
	f.h.T().Helper()
	var out struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id": category, "amount": apitest.BRL(amount), "effective_from": from, "rollover": rollover,
	}, http.StatusCreated, &out)
	return out.ID
}

func (f fixture) progress(budget, month string) progressView {
	f.h.T().Helper()
	var out progressView
	f.h.MustDo(http.MethodGet, "/api/v1/budgets/"+budget+"/progress?month="+month, nil, http.StatusOK, &out)
	return out
}

func checkProgress(t *testing.T, got progressView, planned, carried, spent, available int64) {
	t.Helper()
	if got.Planned.Amount != planned || got.Carried.Amount != carried || got.Spent.Amount != spent || got.Available.Amount != available {
		t.Errorf("%s progress = planned %d carried %d spent %d available %d, want %d %d %d %d", got.Month,
			got.Planned.Amount, got.Carried.Amount, got.Spent.Amount, got.Available.Amount, planned, carried, spent, available)
	}
}

// S60: a Food budget with rollover across three months and an amount change.
func TestS60BudgetWithRollover(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	food := f.h.Account("Food", "expense", "", nil)
	market := f.h.Account("Supermarket", "expense", "", map[string]any{"parent_id": food})
	restaurant := f.h.Account("Restaurant", "expense", "", map[string]any{"parent_id": food})
	f.h.Record("2026-10-10", apitest.Posting(f.checking, -100000), apitest.Posting(market, 100000))
	f.h.Record("2026-10-20", apitest.Posting(f.checking, -50000), apitest.Posting(restaurant, 50000))
	f.h.Record("2026-11-15", apitest.Posting(f.checking, -230000), apitest.Posting(market, 230000))
	id := f.budget(food, 180000, "2026-10", true)
	f.h.MustDo(http.MethodPost, "/api/v1/budgets/"+id+"/amounts", map[string]any{"effective_from": "2026-12", "amount": apitest.BRL(200000)}, http.StatusCreated, nil)
	checkProgress(t, f.progress(id, "2026-10"), 180000, 0, 150000, 30000)
	checkProgress(t, f.progress(id, "2026-11"), 180000, 30000, 230000, -20000)
	checkProgress(t, f.progress(id, "2026-12"), 200000, -20000, 0, 180000)
	var b struct {
		CategoryID string `json:"category_id"`
		Rollover   bool   `json:"rollover"`
		Amounts    []struct {
			EffectiveFrom string `json:"effective_from"`
		} `json:"amounts"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/budgets/"+id, nil, http.StatusOK, &b)
	if b.CategoryID != food || !b.Rollover || len(b.Amounts) != 2 || b.Amounts[1].EffectiveFrom != "2026-12" {
		t.Errorf("budget = %+v", b)
	}
}

func TestBudgetWithoutRolloverAndIncome(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	f.h.Record("2026-10-05", apitest.Posting(f.checking, 500000), apitest.Posting(f.salary, -500000))
	f.h.Record("2026-10-06", apitest.Posting(f.checking, -100000), apitest.Posting(f.rent, 100000))
	income := f.budget(f.salary, 600000, "2026-10", false)
	checkProgress(t, f.progress(income, "2026-10"), 600000, 0, 500000, 100000)
	rent := f.budget(f.rent, 50000, "2026-10", false)
	checkProgress(t, f.progress(rent, "2026-11"), 50000, 0, 0, 50000)
}

func TestBudgetErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	id := f.budget(f.rent, 100000, "2026-10", true)
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/budgets/"+id+"/progress?month=2026-09", nil), http.StatusUnprocessableEntity, "validation_failed", "month")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id": f.rent, "amount": apitest.BRL(1), "effective_from": "2026-11", "rollover": false,
	}), http.StatusConflict, "budget_exists", "")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id": f.checking, "amount": apitest.BRL(1), "effective_from": "2026-11", "rollover": false,
	}), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/budgets/"+id+"/amounts", map[string]any{"effective_from": "2026-10", "amount": apitest.BRL(1)}),
		http.StatusUnprocessableEntity, "validation_failed", "effective_from")
	other := f.h.Login("other@example.com")
	if r := f.h.Call(other, http.MethodGet, "/api/v1/budgets/"+id, nil); r.Status != http.StatusNotFound {
		t.Errorf("other user's budget status = %d", r.Status)
	}
	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != id {
		t.Errorf("budgets = %+v", list.Items)
	}
}

// S144: a budget created by mistake is deleted with its amounts; its category and postings stay,
// and the category takes a new budget.
func TestS144DeleteBudget(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-11-10", apitest.Posting(f.checking, -5000), apitest.Posting(food, 5000))
	id := f.budget(food, 180000, "2026-10", true)
	other := f.h.Login("other@example.com")
	if r := f.h.Call(other, http.MethodDelete, "/api/v1/budgets/"+id, nil); r.Status != http.StatusNotFound {
		t.Fatalf("other user's delete = %d", r.Status)
	}
	f.h.MustDo(http.MethodDelete, "/api/v1/budgets/"+id, nil, http.StatusNoContent, nil)
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/budgets/"+id, nil), http.StatusNotFound, "not_found", "")
	f.h.ExpectProblem(f.h.Do(http.MethodDelete, "/api/v1/budgets/"+id, nil), http.StatusNotFound, "not_found", "")
	if list := f.budgets(); len(list.Items) != 0 {
		t.Errorf("budgets after delete = %+v", list.Items)
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+food, nil, http.StatusOK, nil)
	again := f.budget(food, 150000, "2026-11", false)
	checkProgress(t, f.progress(again, "2026-11"), 150000, 0, 5000, 145000)
}
