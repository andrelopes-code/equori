package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type goalView struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	DueOn  string `json:"due_on"`
	Target struct {
		Amount int64 `json:"amount"`
	} `json:"target"`
	AccountIDs []string `json:"account_ids"`
	Current    struct {
		Amount int64 `json:"amount"`
	} `json:"current"`
	Remaining struct {
		Amount int64 `json:"amount"`
	} `json:"remaining"`
	ProgressBP int `json:"progress_bp"`
}

func (f fixture) goal(name string, target int64, accounts ...string) goalView {
	f.h.T().Helper()
	var out goalView
	f.h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name": name, "target": apitest.BRL(target), "due_on": "2027-06-30", "account_ids": accounts,
	}, http.StatusCreated, &out)
	return out
}

// S61: progress of an emergency fund goal.
func TestS61GoalProgress(t *testing.T) {
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-10-31", apitest.Posting(f.checking, -1008341), apitest.Posting(f.savings, 1008341))
	created := f.goal("Emergency", 3000000, f.savings)
	var got goalView
	f.h.MustDo(http.MethodGet, "/api/v1/goals/"+created.ID, nil, http.StatusOK, &got)
	if got.Name != "Emergency" || got.DueOn != "2027-06-30" || got.Target.Amount != 3000000 || len(got.AccountIDs) != 1 ||
		got.Current.Amount != 1008341 || got.Remaining.Amount != 1991659 || got.ProgressBP != 3361 {
		t.Fatalf("goal = %+v", got)
	}
	var list struct {
		Items []goalView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/goals", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ProgressBP != 3361 {
		t.Errorf("goals = %+v", list.Items)
	}
}

func TestGoalBeyondTarget(t *testing.T) {
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-10-31", apitest.Posting(f.checking, -50000), apitest.Posting(f.savings, 50000))
	got := f.goal("Trip", 40000, f.savings, f.checking)
	if got.Current.Amount != 0 || got.Remaining.Amount != 40000 || got.ProgressBP != 0 {
		t.Fatalf("two accounts netting zero = %+v", got)
	}
	got = f.goal("Reserve", 40000, f.savings)
	if got.Current.Amount != 50000 || got.Remaining.Amount != 0 || got.ProgressBP != 10000 {
		t.Fatalf("beyond target = %+v", got)
	}
}

func TestGoalErrors(t *testing.T) {
	f := newFixture(t, "2026-11-12")
	post := func(body map[string]any) apitest.Response { return f.h.Do(http.MethodPost, "/api/v1/goals", body) }
	body := func(target int64, accounts ...string) map[string]any {
		return map[string]any{"name": "Goal", "target": apitest.BRL(target), "due_on": "2027-06-30", "account_ids": accounts}
	}
	f.h.ExpectProblem(post(body(100, f.rent)), http.StatusUnprocessableEntity, "validation_failed", "account_ids")
	f.h.ExpectProblem(post(body(100)), http.StatusBadRequest, "invalid_request", "account_ids")
	f.h.ExpectProblem(post(body(0, f.savings)), http.StatusUnprocessableEntity, "validation_failed", "target")
	wise := f.h.Account("Wise", "asset", "checking", map[string]any{"currency": "USD"})
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-11-10", "value": "5.5"}, http.StatusCreated, nil)
	dollars := body(100, wise)
	dollars["name"] = "Dollars"
	f.h.MustDo(http.MethodPost, "/api/v1/goals", dollars, http.StatusCreated, nil)
	f.h.Record("2026-11-01", apitest.Posting(f.savings, 100), apitest.Posting(f.salary, -100))
	f.h.ExpectProblem(post(map[string]any{"name": "Euro", "target": map[string]any{"amount": 100, "currency": "EUR"}, "due_on": "2027-06-30", "account_ids": []string{f.savings}}),
		http.StatusUnprocessableEntity, "price_missing", "")
	f.goal("Goal", 100, f.savings)
	f.h.ExpectProblem(post(body(100, f.savings)), http.StatusUnprocessableEntity, "validation_failed", "name")
	other := f.h.Login("other@example.com")
	var list struct {
		Items []goalView `json:"items"`
	}
	r := f.h.Call(other, http.MethodGet, "/api/v1/goals", nil)
	r.Decode(t, &list)
	if r.Status != http.StatusOK || len(list.Items) != 0 {
		t.Errorf("other user's goals = %d %+v", r.Status, list.Items)
	}
}
