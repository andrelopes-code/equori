package planning_test

import (
	"net/http"
	"testing"
)

type budgetListView struct {
	Items []struct {
		ID         string `json:"id"`
		CategoryID string `json:"category_id"`
		Amounts    []struct {
			Amount struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"amounts"`
	} `json:"items"`
}

func (f fixture) mergeCategory(from, into string) {
	f.h.T().Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+from+"/merge", map[string]string{"into": into}, http.StatusOK, nil)
	f.h.Dispatch()
}

func (f fixture) budgets() budgetListView {
	f.h.T().Helper()
	var out budgetListView
	f.h.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &out)
	return out
}

// A75: the source budget moves to a destination without one; schedules follow.
func TestMergeMovesBudgetAndSchedules(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	housing := f.h.Account("Housing", "expense", "", nil)
	budget := f.budget(f.rent, 200000, "2026-11", false)
	schedule := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, "following"), nil)

	f.mergeCategory(f.rent, housing)

	got := f.budgets()
	if len(got.Items) != 1 || got.Items[0].ID != budget || got.Items[0].CategoryID != housing {
		t.Fatalf("budgets after merge = %+v", got.Items)
	}
	var s struct {
		CounterpartID string `json:"counterpart_id"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+schedule, nil, http.StatusOK, &s)
	if s.CounterpartID != housing {
		t.Fatalf("schedule counterpart = %q, want housing", s.CounterpartID)
	}
}

// Review Focus 5: with a budget on both, the destination budget stays as it was.
func TestMergeDropsSourceBudgetWhenBothHaveOne(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	housing := f.h.Account("Housing", "expense", "", nil)
	f.budget(f.rent, 200000, "2026-11", false)
	kept := f.budget(housing, 50000, "2026-11", true)

	f.mergeCategory(f.rent, housing)

	got := f.budgets()
	if len(got.Items) != 1 || got.Items[0].ID != kept || got.Items[0].CategoryID != housing ||
		len(got.Items[0].Amounts) != 1 || got.Items[0].Amounts[0].Amount.Amount != 50000 {
		t.Fatalf("budgets after merge = %+v", got.Items)
	}
}
