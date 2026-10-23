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
	// TrailingReturn is nil when the accounts have too little history or no flow (A124).
	TrailingReturn *struct {
		PeriodMonths int `json:"period_months"`
		AnnualBP     int `json:"annual_bp"`
	} `json:"trailing_return"`
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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

// S119: editing a goal changes only the fields sent and measures the result again.
func TestS119UpdateGoal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-10-31", apitest.Posting(f.checking, -1008341), apitest.Posting(f.savings, 1008341))
	created := f.goal("Emergency", 3000000, f.savings)
	var got goalView
	f.h.MustDo(http.MethodPatch, "/api/v1/goals/"+created.ID, map[string]any{"name": "Reserve", "target": apitest.BRL(2016682)}, http.StatusOK, &got)
	if got.Name != "Reserve" || got.Target.Amount != 2016682 || got.DueOn != "2027-06-30" || len(got.AccountIDs) != 1 ||
		got.Current.Amount != 1008341 || got.Remaining.Amount != 1008341 || got.ProgressBP != 5000 {
		t.Fatalf("renamed and retargeted goal = %+v", got)
	}
	f.h.MustDo(http.MethodPatch, "/api/v1/goals/"+created.ID, map[string]any{"due_on": "2028-01-31", "account_ids": []string{f.savings, f.checking}}, http.StatusOK, &got)
	if got.Name != "Reserve" || got.DueOn != "2028-01-31" || len(got.AccountIDs) != 2 || got.Current.Amount != 0 || got.ProgressBP != 0 {
		t.Fatalf("goal over two accounts = %+v", got)
	}
	f.h.MustDo(http.MethodGet, "/api/v1/goals/"+created.ID, nil, http.StatusOK, &got)
	if got.Name != "Reserve" || got.DueOn != "2028-01-31" || len(got.AccountIDs) != 2 {
		t.Errorf("stored goal = %+v", got)
	}
}

func TestGoalUpdateErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	first := f.goal("First", 100, f.savings)
	second := f.goal("Second", 100, f.savings)
	patch := func(id string, body map[string]any) apitest.Response {
		return f.h.Do(http.MethodPatch, "/api/v1/goals/"+id, body)
	}
	f.h.ExpectProblem(patch(second.ID, map[string]any{"name": "First"}), http.StatusUnprocessableEntity, "validation_failed", "name")
	f.h.ExpectProblem(patch(second.ID, map[string]any{"name": ""}), http.StatusBadRequest, "invalid_request", "name")
	f.h.ExpectProblem(patch(second.ID, map[string]any{"target": apitest.BRL(0)}), http.StatusUnprocessableEntity, "validation_failed", "target")
	f.h.ExpectProblem(patch(second.ID, map[string]any{"account_ids": []string{f.rent}}), http.StatusUnprocessableEntity, "validation_failed", "account_ids")
	f.h.ExpectProblem(patch(second.ID, map[string]any{}), http.StatusBadRequest, "invalid_request", "")
	f.h.ExpectProblem(patch("00000000-0000-4000-8000-000000000000", map[string]any{"name": "Third"}), http.StatusNotFound, "not_found", "")
	f.h.MustDo(http.MethodPatch, "/api/v1/goals/"+first.ID, map[string]any{"name": "First"}, http.StatusOK, nil)
	other := f.h.Login("other@example.com")
	if r := f.h.Call(other, http.MethodPatch, "/api/v1/goals/"+first.ID, map[string]any{"name": "Mine"}); r.Status != http.StatusNotFound {
		t.Errorf("other user's update = %d", r.Status)
	}
}

// S120: deleting a goal removes it and its accounts and leaves the accounts themselves.
func TestS120DeleteGoal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	created := f.goal("Emergency", 3000000, f.savings)
	other := f.h.Login("other@example.com")
	if r := f.h.Call(other, http.MethodDelete, "/api/v1/goals/"+created.ID, nil); r.Status != http.StatusNotFound {
		t.Fatalf("other user's delete = %d", r.Status)
	}
	f.h.MustDo(http.MethodDelete, "/api/v1/goals/"+created.ID, nil, http.StatusNoContent, nil)
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/goals/"+created.ID, nil), http.StatusNotFound, "not_found", "")
	f.h.ExpectProblem(f.h.Do(http.MethodDelete, "/api/v1/goals/"+created.ID, nil), http.StatusNotFound, "not_found", "")
	var list struct {
		Items []goalView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/goals", nil, http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Errorf("goals after delete = %+v", list.Items)
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.savings, nil, http.StatusOK, nil)
	f.goal("Emergency", 3000000, f.savings)
}

// A goal that cannot be measured is not stored, so the list keeps working.
func TestGoalWithoutPriceIsNotStored(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-11-01", apitest.Posting(f.savings, 100), apitest.Posting(f.salary, -100))
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/goals", map[string]any{
		"name": "Euro", "target": map[string]any{"amount": 100, "currency": "EUR"}, "due_on": "2027-06-30", "account_ids": []string{f.savings},
	}), http.StatusUnprocessableEntity, "price_missing", "")
	var list struct {
		Items []goalView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/goals", nil, http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Errorf("goals = %+v", list.Items)
	}
}

// S130: a goal reports the return of its accounts over the last 12 months (amendment A124).
func TestS130GoalTrailingReturn(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	reserve := f.h.Account("Reserve B", "asset", "savings", nil)
	f.h.Record("2025-10-15", apitest.Posting(f.checking, -100000), apitest.Posting(f.savings, 100000))
	f.h.Record("2026-04-30", apitest.Posting(f.checking, -100000), apitest.Posting(f.savings, 100000))
	f.h.Record("2026-06-10", apitest.Posting(f.savings, -30000), apitest.Posting(reserve, 30000))
	f.h.Record("2026-10-26", apitest.Posting(f.savings, 5000), apitest.Posting(f.salary, -5000))

	// The window starts on 2025-11-12: the opening is 1,000.00 on 2025-11-11, a contribution of
	// 1,000.00 on 2026-04-30, the closing 2,050.00 on 2026-11-12; the transfer between the two
	// accounts of the goal is not a flow. The rate was solved independently with 50-digit
	// decimals, days over 365 (opening to closing: 366 days).
	mix := f.goal("Mix", 1000000, f.savings, reserve)
	var got goalView
	f.h.MustDo(http.MethodGet, "/api/v1/goals/"+mix.ID, nil, http.StatusOK, &got)
	if got.TrailingReturn == nil || got.TrailingReturn.PeriodMonths != 12 || got.TrailingReturn.AnnualBP != 326 {
		t.Fatalf("trailing return = %+v", got.TrailingReturn)
	}
	var list struct {
		Items []goalView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/goals", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].TrailingReturn == nil || list.Items[0].TrailingReturn.AnnualBP != 326 {
		t.Fatalf("listed = %+v", list.Items)
	}

	absent := func(name string, accounts ...string) {
		t.Helper()
		g := f.goal(name, 1000000, accounts...)
		var read goalView
		f.h.MustDo(http.MethodGet, "/api/v1/goals/"+g.ID, nil, http.StatusOK, &read)
		if read.TrailingReturn != nil {
			t.Errorf("%s has a trailing return: %+v", name, read.TrailingReturn)
		}
	}
	empty := f.h.Account("Empty", "asset", "savings", nil)
	absent("No history", empty)
	young := f.h.Account("Young", "asset", "savings", nil)
	f.h.Record("2026-09-12", apitest.Posting(f.checking, -10000), apitest.Posting(young, 10000))
	absent("Two months", young)
	old := f.h.Account("Old", "asset", "savings", nil)
	f.h.Record("2025-06-01", apitest.Posting(f.checking, -10000), apitest.Posting(old, 10000))
	absent("No flow in the window", old)
}
