package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type goalExpensesView struct {
	Items []struct {
		TransactionID string `json:"transaction_id"`
		Date          string `json:"date"`
		Description   string `json:"description"`
		Amount        money  `json:"amount"`
		Direct        bool   `json:"direct"`
	} `json:"items"`
}

func goalExpensePath(goal, tx string) string {
	return "/api/v1/goals/" + goal + "/expenses/" + tx
}

func (f fixture) goalExpenses(goal string) goalExpensesView {
	f.h.T().Helper()

	var out goalExpensesView
	f.h.MustDo(http.MethodGet, "/api/v1/goals/"+goal+"/expenses", nil, http.StatusOK, &out)

	return out
}

func (f fixture) goalByID(id string) goalView {
	f.h.T().Helper()

	var out goalView
	f.h.MustDo(http.MethodGet, "/api/v1/goals/"+id, nil, http.StatusOK, &out)

	return out
}

// S584: an expense linked to a goal stays in the real amount of its bucket and counts as paid by
// the goal: the bucket is judged without it, the budget of its category leaves it out of the
// spending and the goal holds it as spent (planning coherence A256, A257).
func TestS584LinkedExpense(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	travel := f.h.Account("Travel", "expense", "", nil)
	goal := f.goal("Trip", 1000000, trip)
	budget := f.budget(travel, 30000, "2026-10", false)
	f.h.Record("2026-09-10", apitest.Posting(trip, 600000), apitest.Posting(f.checking, -600000))
	f.h.Record("2026-10-01", apitest.Posting(f.checking, 500000), apitest.Posting(trip, -500000))
	flight := f.pay("2026-10-06", 500000, travel, "")
	f.pay("2026-10-07", 20000, travel, "")
	f.goalsAndFreedom(travel)

	f.h.MustDo(http.MethodPut, goalExpensePath(goal.ID, flight), nil, http.StatusNoContent, nil)

	needs := f.history("2026-11").Months[4].Buckets[0]
	if needs.Real.Amount != 520000 || amountOf(needs.GoalPaid) != 500000 {
		t.Errorf("needs = real %d goal paid %d, want 520000 500000",
			needs.Real.Amount, amountOf(needs.GoalPaid))
	}

	progress := f.progress(budget, "2026-10")
	if progress.Spent.Amount != 20000 || amountOf(progress.GoalPaid) != 500000 ||
		progress.Available.Amount != 10000 {
		t.Errorf("progress = spent %d goal paid %d available %d, want 20000 500000 10000",
			progress.Spent.Amount, amountOf(progress.GoalPaid), progress.Available.Amount)
	}

	if spent := f.goalByID(goal.ID).Spent; amountOf(spent) != 500000 {
		t.Errorf("goal spent = %d, want 500000", amountOf(spent))
	}

	listed := f.goalExpenses(goal.ID).Items
	if len(listed) != 1 || listed[0].TransactionID != flight || listed[0].Amount.Amount != 500000 ||
		listed[0].Direct || listed[0].Date != "2026-10-06" {
		t.Errorf("expenses = %+v, want the flight, linked", listed)
	}

	f.h.MustDo(http.MethodDelete, goalExpensePath(goal.ID, flight), nil, http.StatusNoContent, nil)

	if got := f.progress(budget, "2026-10"); got.Spent.Amount != 520000 ||
		amountOf(got.GoalPaid) != 0 {
		t.Errorf("unlinked = spent %d goal paid %d, want 520000 0",
			got.Spent.Amount, amountOf(got.GoalPaid))
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodDelete, goalExpensePath(goal.ID, flight), nil),
		http.StatusNotFound, "not_found", "",
	)
}

// S585: a second link of one transaction replaces the first; a voided transaction, one without an
// expense posting and one of no book are rejected on transaction_id (A256).
func TestS585GoalExpenseLinkRules(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	first := f.goal("First", 1000000, f.savings)
	second := f.goal("Second", 1000000, f.checking)
	expense := f.pay("2026-10-06", 5000, f.rent, "")
	transfer := f.h.Record(
		"2026-10-07",
		apitest.Posting(f.savings, 1000),
		apitest.Posting(f.checking, -1000),
	)
	voided := f.pay("2026-10-08", 700, f.rent, "")
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/transactions/"+voided+"/void",
		map[string]string{"reason": "duplicate"},
		http.StatusOK,
		nil,
	)

	f.h.MustDo(http.MethodPut, goalExpensePath(first.ID, expense), nil, http.StatusNoContent, nil)
	f.h.MustDo(http.MethodPut, goalExpensePath(second.ID, expense), nil, http.StatusNoContent, nil)

	if n := len(f.goalExpenses(first.ID).Items); n != 0 {
		t.Errorf("first goal holds %d expenses, want 0", n)
	}

	if n := len(f.goalExpenses(second.ID).Items); n != 1 {
		t.Errorf("second goal holds %d expenses, want 1", n)
	}

	for name, tx := range map[string]string{
		"transfer": transfer,
		"voided":   voided,
		"unknown":  "00000000-0000-4000-8000-000000000001",
	} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPut, goalExpensePath(first.ID, tx), nil),
			http.StatusUnprocessableEntity, "validation_failed", "transaction_id",
		)
		t.Log(name)
	}

	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPut,
			goalExpensePath("00000000-0000-4000-8000-000000000002", expense),
			nil,
		),
		http.StatusNotFound, "not_found", "",
	)
}

// S586: an expense paid from an account one goal holds whole is paid by that goal, direct; from
// an account two goals hold, by none (A256).
func TestS586DirectPayment(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	shared := f.h.Account("Shared", "asset", "savings", nil)
	travel := f.h.Account("Travel", "expense", "", nil)
	goal := f.goal("Trip", 1000000, trip, shared)
	other := f.goal("Other", 1000000, shared)
	f.h.Record("2026-09-10", apitest.Posting(trip, 600000), apitest.Posting(f.checking, -600000))
	f.h.Record("2026-09-11", apitest.Posting(shared, 600000), apitest.Posting(f.checking, -600000))
	direct := f.h.Record(
		"2026-10-06",
		apitest.Posting(travel, 40000),
		apitest.Posting(trip, -40000),
	)
	f.h.Record("2026-10-07", apitest.Posting(travel, 9000), apitest.Posting(shared, -9000))
	f.goalsAndFreedom(travel)

	listed := f.goalExpenses(goal.ID).Items
	if len(listed) != 1 || listed[0].TransactionID != direct || !listed[0].Direct ||
		listed[0].Amount.Amount != 40000 {
		t.Errorf("expenses = %+v, want the direct payment of 400.00", listed)
	}

	if n := len(f.goalExpenses(other.ID).Items); n != 0 {
		t.Errorf("other goal holds %d expenses, want 0", n)
	}

	needs := f.history("2026-11").Months[4].Buckets[0]
	if needs.Real.Amount != 49000 || amountOf(needs.GoalPaid) != 40000 {
		t.Errorf("needs = real %d goal paid %d, want 49000 40000",
			needs.Real.Amount, amountOf(needs.GoalPaid))
	}

	if spent := f.goalByID(goal.ID).Spent; amountOf(spent) != 40000 {
		t.Errorf("goal spent = %d, want 40000", amountOf(spent))
	}
}

// S589, goal expenses: a reader lists and cannot link or unlink, a writer links, and a request
// without a session is rejected (B2).
func TestGoalExpenseRoles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	goal := f.goal("Trip", 1000000, f.savings)
	expense := f.pay("2026-10-06", 5000, f.rent, "")
	path, list := goalExpensePath(goal.ID, expense), "/api/v1/goals/"+goal.ID+"/expenses"

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		f.h.ExpectProblem(
			f.h.Call(reader, method, path, nil),
			http.StatusForbidden, "book_role_required", "",
		)
	}

	if r := f.h.Call(reader, http.MethodGet, list, nil); r.Status != http.StatusOK {
		t.Errorf("reader GET = %d: %s", r.Status, r.Body)
	}

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.h.Call(writer, http.MethodPut, path, nil); r.Status != http.StatusNoContent {
		t.Errorf("writer PUT = %d: %s", r.Status, r.Body)
	}

	if r := f.h.Call(writer, http.MethodDelete, path, nil); r.Status != http.StatusNoContent {
		t.Errorf("writer DELETE = %d: %s", r.Status, r.Body)
	}

	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		f.h.ExpectProblem(
			f.h.Call(&http.Client{}, method, path, nil),
			http.StatusUnauthorized, "unauthenticated", "",
		)
	}

	f.h.ExpectProblem(
		f.h.Call(&http.Client{}, http.MethodGet, list, nil),
		http.StatusUnauthorized, "unauthenticated", "",
	)

	// A goal of another book is not found.
	other := f.h.Login("other@example.com")
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodGet, list, nil),
		http.StatusNotFound, "not_found", "",
	)
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodPut, path, nil),
		http.StatusNotFound, "not_found", "",
	)
}

// The database rejects a goal expense without a book, a second link of one transaction, a goal
// of another book and a transaction of another book (planning coherence B1).
func TestGoalExpenseSchema(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	goal := f.goal("Trip", 1000000, f.savings)
	second := f.goal("Second", 1000000, f.checking)
	expense := f.pay("2026-10-06", 5000, f.rent, "")
	book := f.h.OwnerID()
	f.h.Login("other@example.com")
	other := f.h.BooksIDOf("other@example.com")

	insert := func(books any, goalID, tx string) error {
		_, err := f.h.Pool.Exec(
			t.Context(),
			`INSERT INTO planning_goal_expense (books_id, transaction_id, goal_id) VALUES ($1, $2, $3)`,
			books,
			tx,
			goalID,
		)

		return err
	}
	if err := insert(book, goal.ID, expense); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		err  error
	}{
		{"without a book", insert(nil, goal.ID, expense)},
		{"second link of one transaction", insert(book, second.ID, expense)},
		{"goal of another book", insert(other, goal.ID, expense)},
		{"unknown transaction", insert(book, goal.ID, "00000000-0000-4000-8000-000000000009")},
	}
	for _, tt := range tests {
		if tt.err == nil {
			t.Errorf("%s: the database accepted the row", tt.name)
		}
	}
}

// The assistant links an expense to a goal through manage_budget_or_goal, previewed first, and
// reads the amount the goal spent (planning coherence S4).
func TestGoalExpenseTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	goal := f.goal("Trip", 1000000, f.savings)
	expense := f.pay("2026-10-06", 5000, f.rent, "")
	args := map[string]any{
		"action": "link_expense", "goal_id": goal.ID, "transaction_id": expense,
	}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s\n%s", r.Content, f.h.Logs())
	}

	if p.Action != "manage_budget_or_goal.link_expense" || p.Target != "Trip" ||
		len(p.Changes) != 2 || p.Changes[0].Field != "transaction" ||
		p.Changes[0].After.Text != "payment" {
		t.Errorf("preview = %+v", p)
	}

	if n := len(f.goalExpenses(goal.ID).Items); n != 0 {
		t.Fatalf("expenses after the preview = %d, want 0", n)
	}

	var out toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", args, &out)

	if amountOf(f.goalByID(goal.ID).Spent) != 5000 {
		t.Errorf("spent = %d, want 5000", amountOf(f.goalByID(goal.ID).Spent))
	}

	args["action"] = "unlink_expense"
	toolOutput(t, f.h, "manage_budget_or_goal", args, &out)

	if amountOf(f.goalByID(goal.ID).Spent) != 0 {
		t.Errorf("spent after unlink = %d, want 0", amountOf(f.goalByID(goal.ID).Spent))
	}

	args["transaction_id"] = "00000000-0000-4000-8000-000000000009"
	f.h.ExpectToolError(
		f.h.Tool("manage_budget_or_goal", args),
		"validation_failed",
		"transaction_id",
	)
}

// A withdrawal from a goal account to checking is unexplained until the expenses linked since it
// reach its amount; an expense paid from the goal account is no withdrawal to explain (A256).
func TestGoalUnexplainedWithdrawal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	travel := f.h.Account("Travel", "expense", "", nil)
	goal := f.goal("Trip", 1000000, trip)
	f.h.Record("2026-09-10", apitest.Posting(trip, 900000), apitest.Posting(f.checking, -900000))
	f.h.Record("2026-10-20", apitest.Posting(travel, 10000), apitest.Posting(trip, -10000))

	if got := f.goalByID(goal.ID).UnexplainedWithdrawal; got != nil {
		t.Fatalf("before a withdrawal = %+v, want none", got)
	}

	f.h.Record("2026-10-01", apitest.Posting(f.checking, 500000), apitest.Posting(trip, -500000))
	flight := f.pay("2026-10-06", 300000, travel, "")
	hotel := f.pay("2026-10-07", 200000, travel, "")

	got := f.goalByID(goal.ID).UnexplainedWithdrawal
	if got == nil || got.Amount.Amount != 500000 || got.Since != "2026-10-01" {
		t.Fatalf("after the withdrawal = %+v, want 500000 since 2026-10-01", got)
	}

	f.h.MustDo(http.MethodPut, goalExpensePath(goal.ID, flight), nil, http.StatusNoContent, nil)

	got = f.goalByID(goal.ID).UnexplainedWithdrawal
	if got == nil || got.Amount.Amount != 200000 {
		t.Fatalf("after one link = %+v, want 200000", got)
	}

	f.h.MustDo(http.MethodPut, goalExpensePath(goal.ID, hotel), nil, http.StatusNoContent, nil)

	if got := f.goalByID(goal.ID).UnexplainedWithdrawal; got != nil {
		t.Errorf("after both links = %+v, want none", got)
	}
}
