package planning_test

import (
	"errors"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type budgetVersions struct {
	Amounts []struct {
		EffectiveFrom string `json:"effective_from"`
		Amount        money  `json:"amount"`
		Ended         *bool  `json:"ended"`
	} `json:"amounts"`
}

// S744: ending a budget keeps the month before the end and takes it out of force after.
func TestS744EndBudget(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	family := f.h.Account("Family help", "expense", "", nil)
	id := f.budget(family, 42800, "2026-11", false)

	got := f.endBudget(id, "2026-12")

	checkVersions(t, got, "2026-11 42800", "2026-12 ended")
	checkProgress(t, f.progress(id, "2026-11"), 42800, 0, 0, 42800)
	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, "/api/v1/budgets/"+id+"/progress?month=2026-12", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"month",
	)

	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ID != id {
		t.Errorf("budgets = %+v, want the ended budget", list.Items)
	}
}

// S745: the end removes the versions after its month.
func TestS745EndRemovesLaterVersions(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	food := f.h.Account("Food", "expense", "", nil)
	id := f.budget(food, 180000, "2026-11", false)
	f.addAmount(id, "2027-01", 150000)

	got := f.endBudget(id, "2026-12")

	checkVersions(t, got, "2026-11 180000", "2026-12 ended")
}

// S746: a new amount after the end resumes the budget.
func TestS746ResumeAfterEnd(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	family := f.h.Account("Family help", "expense", "", nil)
	id := f.budget(family, 42800, "2026-11", true)
	f.endBudget(id, "2026-12")

	f.addAmount(id, "2027-02", 30000)

	checkProgress(t, f.progress(id, "2027-02"), 30000, 0, 0, 30000)
	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, "/api/v1/budgets/"+id+"/progress?month=2027-01", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"month",
	)
}

// S747: a rollover budget carries nothing across its end.
func TestS747RolloverStopsAtEnd(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	leisure := f.h.Account("Leisure", "expense", "", nil)
	f.h.Record("2026-11-10", apitest.Posting(f.checking, -20000), apitest.Posting(leisure, 20000))
	id := f.budget(leisure, 50000, "2026-11", true)
	f.endBudget(id, "2026-12")

	f.addAmount(id, "2027-01", 50000)

	checkProgress(t, f.progress(id, "2026-11"), 50000, 0, 20000, 30000)
	checkProgress(t, f.progress(id, "2027-01"), 50000, 0, 0, 50000)
}

// S748: an ended parent stops keeping its subcategories out of the plan's count.
func TestS748EndedParentStopsCovering(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	food := f.h.Account("Food", "expense", "", nil)
	delivery := f.h.Account("Delivery", "expense", "", map[string]any{"parent_id": food})
	foodBudget := f.budget(food, 100000, "2026-11", false)
	f.budget(delivery, 20000, "2026-11", false)

	f.endBudget(foodBudget, "2026-12")

	november := f.plan("2026-11")
	december := f.plan("2026-12")

	if row, ok := planRow(november, delivery); !ok || row.Counted {
		t.Errorf("2026-11 Delivery row = %+v (found %t), want listed and not counted", row, ok)
	}

	if row, ok := planRow(december, delivery); !ok || !row.Counted {
		t.Errorf("2026-12 Delivery row = %+v (found %t), want counted", row, ok)
	}

	if row, ok := planRow(december, food); ok {
		t.Errorf("2026-12 Food row = %+v, want none after the end", row)
	}
}

// S749: the plan creates nothing on an ended budget at zero and resumes it above zero.
func TestS749PlanResumesEndedBudget(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	family := f.h.Account("Family help", "expense", "", nil)
	id := f.budget(family, 42800, "2026-11", false)
	f.endBudget(id, "2026-12")

	f.savePlan(
		"2026-12",
		map[string]any{"source": "average_income", "amounts": amounts(family, apitest.BRL(0))},
	)

	checkVersions(t, f.budgetVersions(id), "2026-11 42800", "2026-12 ended")

	f.savePlan(
		"2026-12",
		map[string]any{"source": "average_income", "amounts": amounts(family, apitest.BRL(35000))},
	)

	checkVersions(t, f.budgetVersions(id), "2026-11 42800", "2026-12 35000")
}

// S750: the month of an end is validated, and only a writer of the book ends its budget.
func TestS750EndBudgetValidationAndAccess(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	family := f.h.Account("Family help", "expense", "", nil)
	id := f.budget(family, 42800, "2026-10", false)
	path := "/api/v1/budgets/" + id + "/end"

	for _, month := range []string{"2026-10", "2026-09", "2027-12"} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPost, path, map[string]any{"month": month}),
			http.StatusUnprocessableEntity,
			"validation_failed",
			"month",
		)
	}

	first := f.budget(f.h.Account("Pets", "expense", "", nil), 10000, "2026-11", false)
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPost,
			"/api/v1/budgets/"+first+"/end",
			map[string]any{"month": "2026-11"},
		),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"month",
	)

	other := f.h.Login("other@example.com")
	if r := f.h.Call(
		other,
		http.MethodPost,
		path,
		map[string]any{"month": "2026-12"},
	); r.Status != http.StatusNotFound {
		t.Errorf("other book's end = %d, want 404", r.Status)
	}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPost, path, map[string]any{"month": "2026-12"}),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.h.Call(
		writer,
		http.MethodPost,
		path,
		map[string]any{"month": "2026-12"},
	); r.Status != http.StatusOK {
		t.Errorf("writer end = %d: %s", r.Status, r.Body)
	}
}

func (f fixture) endBudget(id, month string) budgetVersions {
	f.h.T().Helper()
	var out budgetVersions
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/budgets/"+id+"/end",
		map[string]any{"month": month},
		http.StatusOK,
		&out,
	)

	return out
}

func (f fixture) addAmount(id, from string, amount int64) {
	f.h.T().Helper()
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/budgets/"+id+"/amounts",
		map[string]any{"effective_from": from, "amount": apitest.BRL(amount)},
		http.StatusCreated,
		nil,
	)
}

func (f fixture) budgetVersions(id string) budgetVersions {
	f.h.T().Helper()
	var out budgetVersions
	f.h.MustDo(http.MethodGet, "/api/v1/budgets/"+id, nil, http.StatusOK, &out)

	return out
}

type planRowView = struct {
	CategoryID string `json:"category_id"`
	BudgetID   string `json:"budget_id"`
	Planned    money  `json:"planned"`
	LastMonth  money  `json:"last_month"`
	Average    money  `json:"average"`
	Counted    bool   `json:"counted"`
	NextChange string `json:"next_change"`
}

func planRow(p planView, category string) (planRowView, bool) {
	for _, r := range p.Rows {
		if r.CategoryID == category {
			return r, true
		}
	}

	return planRowView{}, false
}

// checkVersions compares the versions of a budget with "YYYY-MM amount" or "YYYY-MM ended".
func checkVersions(t *testing.T, got budgetVersions, want ...string) {
	t.Helper()

	lines := make([]string, len(got.Amounts))
	for i, a := range got.Amounts {
		if a.Ended == nil {
			t.Fatalf("version %s has no ended field", a.EffectiveFrom)
		}

		lines[i] = a.EffectiveFrom + " " + strconv.FormatInt(a.Amount.Amount, 10)
		if *a.Ended {
			lines[i] = a.EffectiveFrom + " ended"
		}
	}

	if !slices.Equal(lines, want) {
		t.Errorf("versions = %v, want %v", lines, want)
	}
}

// Budget end E1: the database rejects an end that carries an amount.
func TestBudgetEndCarriesNoAmount(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	id := f.budget(f.h.Account("Family help", "expense", "", nil), 42800, "2026-11", false)
	insert := func(from string, amount int64) error {
		_, err := f.h.Pool.Exec(
			t.Context(),
			`INSERT INTO planning_budget_amount (books_id, budget_id, effective_from, amount, ended)
			VALUES ($1, $2, $3, $4, true)`,
			f.h.OwnerID(),
			id,
			from,
			amount,
		)

		return err
	}

	err := insert("2026-12-01", 100)

	if pe, ok := errors.AsType[*pgconn.PgError](err); !ok || pe.Code != "23514" {
		t.Errorf("end with an amount: err = %v, want a check violation", err)
	}

	if err := insert("2026-12-01", 0); err != nil {
		t.Errorf("end without an amount: %v", err)
	}
}

// S751: end_budget previews the removed version and the dropped balance as destructive, then
// ends the budget.
func TestS751EndBudgetThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-11-10", apitest.Posting(f.checking, -50000), apitest.Posting(food, 50000))
	id := f.budget(food, 180000, "2026-11", true)
	f.addAmount(id, "2027-01", 150000)
	end := map[string]any{"action": "end_budget", "budget_id": id, "month": "2026-12"}

	p, r := preview(t, f.h, "manage_budget_or_goal", end)
	if r.IsError {
		t.Fatalf("end preview error: %+v", r)
	}

	want := []tool.Change{
		{Field: "budget", Before: tool.TextValue("Food")},
		{Field: "until", After: tool.Value{Date: "2026-11-30"}},
		{Field: "from", Before: tool.Value{Date: "2027-01-01"}},
		{Field: "amount", Before: tool.Value{Amount: "1500.00", Currency: "BRL"}},
		{Field: "carried", Before: tool.Value{Amount: "1300.00", Currency: "BRL"}},
	}
	if p.Target != "Food" || !p.Destructive || !reflect.DeepEqual(p.Changes, want) {
		t.Errorf("end preview = %+v, want target Food, destructive, changes %+v", p, want)
	}

	var ended toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", end, &ended)

	if ended.BudgetID != id {
		t.Errorf("end = %+v", ended)
	}

	checkVersions(t, f.budgetVersions(id), "2026-11 180000", "2026-12 ended")
	f.h.ExpectToolError(
		f.h.Tool("manage_budget_or_goal", map[string]any{"action": "end_budget", "budget_id": id}),
		"invalid_arguments",
		"month",
	)
}

// Budget end E20: an end that removes nothing and drops nothing is not destructive.
func TestEndBudgetPreviewWithoutLoss(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-26")
	family := f.h.Account("Family help", "expense", "", nil)
	id := f.budget(family, 42800, "2026-11", false)

	p, _ := preview(
		t,
		f.h,
		"manage_budget_or_goal",
		map[string]any{"action": "end_budget", "budget_id": id, "month": "2026-12"},
	)

	want := []tool.Change{
		{Field: "budget", Before: tool.TextValue("Family help")},
		{Field: "until", After: tool.Value{Date: "2026-11-30"}},
	}
	if p.Destructive || !reflect.DeepEqual(p.Changes, want) {
		t.Errorf("end preview = %+v, want not destructive with changes %+v", p, want)
	}
}
