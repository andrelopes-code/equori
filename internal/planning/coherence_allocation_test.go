package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// allocatedGoal creates a goal that holds the accounts by allocated amounts.
func (f fixture) allocatedGoal(name string, accounts ...string) goalView {
	f.h.T().Helper()

	var out goalView
	f.h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name":                  name,
		"target":                apitest.BRL(10000000),
		"due_on":                "2027-06-30",
		"allocated_account_ids": accounts,
	}, http.StatusCreated, &out)

	return out
}

func allocationsPath(goal string) string { return "/api/v1/goals/" + goal + "/allocations" }

// allocate assigns a signed amount of the account to the goal and returns the goal.
func (f fixture) allocate(goal, account string, amount int64, on string) goalView {
	f.h.T().Helper()

	body := map[string]any{"account_id": account, "amount": apitest.BRL(amount)}
	if on != "" {
		body["booked_on"] = on
	}

	var out goalView
	f.h.MustDo(http.MethodPost, allocationsPath(goal), body, http.StatusOK, &out)

	return out
}

// sharedAccount records 30,000.00 on the fixture's savings account and allocates 20,000.00 and
// 5,000.00 of it to two goals.
func (f fixture) sharedAccount() (car, trip goalView) {
	f.h.T().Helper()
	f.h.Record(
		"2026-09-10",
		apitest.Posting(f.savings, 3000000),
		apitest.Posting(f.salary, -3000000),
	)

	car, trip = f.allocatedGoal("Car", f.savings), f.allocatedGoal("Trip", f.savings)
	f.allocate(car.ID, f.savings, 2000000, "2026-10-05")

	return f.goalByID(car.ID), f.allocate(trip.ID, f.savings, 500000, "2026-10-06")
}

// S578: a savings account of 30,000.00 allocated to two goals with 20,000.00 and 5,000.00: each
// goal holds its allocation as current and the account has 5,000.00 available (A255). S588: each
// goal names the other in shared_with.
func TestS578AccountAllocatedToTwoGoals(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	car, trip := f.sharedAccount()
	car = f.goalByID(car.ID)

	if car.Current.Amount != 2000000 || trip.Current.Amount != 500000 {
		t.Errorf("current = %d and %d, want 2000000 and 500000",
			car.Current.Amount, trip.Current.Amount)
	}

	if len(car.AllocatedAccounts) != 1 || car.AllocatedAccounts[0].AccountID != f.savings ||
		car.AllocatedAccounts[0].Allocated.Amount != 2000000 ||
		car.AllocatedAccounts[0].Available.Amount != 500000 {
		t.Errorf("allocated accounts of car = %+v, want 2000000 with 500000 available",
			car.AllocatedAccounts)
	}

	if len(car.AccountIDs) != 0 || car.OverAllocated != nil {
		t.Errorf("car = accounts %v over %v, want none", car.AccountIDs, car.OverAllocated)
	}

	if len(car.SharedWith) != 1 || car.SharedWith[0] != trip.ID ||
		len(trip.SharedWith) != 1 || trip.SharedWith[0] != car.ID {
		t.Errorf("shared_with = %v and %v", car.SharedWith, trip.SharedWith)
	}

	var listed struct {
		Items []struct {
			ID        string `json:"id"`
			AccountID string `json:"account_id"`
			BookedOn  string `json:"booked_on"`
			Amount    money  `json:"amount"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, allocationsPath(car.ID), nil, http.StatusOK, &listed)

	if len(listed.Items) != 1 || listed.Items[0].Amount.Amount != 2000000 ||
		listed.Items[0].BookedOn != "2026-10-05" || listed.Items[0].AccountID != f.savings {
		t.Fatalf("allocations = %+v", listed.Items)
	}

	f.h.MustDo(
		http.MethodDelete,
		allocationsPath(car.ID)+"/"+listed.Items[0].ID,
		nil,
		http.StatusNoContent,
		nil,
	)

	if got := f.goalByID(car.ID).Current.Amount; got != 0 {
		t.Errorf("current after the delete = %d, want 0", got)
	}
}

// S579: an allocation above the available amount and a release that brings a goal below zero are
// rejected on amount; an account the goal does not hold allocated is rejected on account_id.
func TestS579AllocationBounds(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	car, _ := f.sharedAccount()
	post := func(account string, amount int64) apitest.Response {
		return f.h.Do(http.MethodPost, allocationsPath(car.ID), map[string]any{
			"account_id": account, "amount": apitest.BRL(amount),
		})
	}

	f.h.ExpectProblem(
		post(f.savings, 600000),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"amount",
	)
	f.h.ExpectProblem(
		post(f.savings, -2000001),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"amount",
	)
	f.h.ExpectProblem(
		post(f.savings, 0),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"amount",
	)
	f.h.ExpectProblem(
		post(f.checking, 100),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"account_id",
	)

	if got := f.allocate(car.ID, f.savings, -500000, ""); got.Current.Amount != 1500000 ||
		got.AllocatedAccounts[0].Available.Amount != 1000000 {
		t.Errorf("after a release = %+v, want 1500000 with 1000000 available", got)
	}
}

// S580: a withdrawal that leaves the balance below the allocations marks both goals
// over-allocated by the missing amount and changes no allocation (A255).
func TestS580OverAllocation(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	car, trip := f.sharedAccount()
	f.h.Record(
		"2026-11-01",
		apitest.Posting(f.checking, 1000000),
		apitest.Posting(f.savings, -1000000),
	)

	car, trip = f.goalByID(car.ID), f.goalByID(trip.ID)

	if amountOf(car.OverAllocated) != 500000 || amountOf(trip.OverAllocated) != 500000 ||
		car.Current.Amount != 2000000 || trip.Current.Amount != 500000 {
		t.Errorf(
			"car = over %d current %d, trip = over %d current %d, want 500000 over and unchanged",
			amountOf(car.OverAllocated),
			car.Current.Amount,
			amountOf(trip.OverAllocated),
			trip.Current.Amount,
		)
	}
}

// S581: an account holds whole links or allocated links, never both; an allocated link takes an
// asset account without children in a currency (A255).
func TestS581AllocatedLinkRules(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	b := f.brokerage()
	whole := f.goal("Whole", 1000000, f.savings)
	f.allocatedGoal("Part", f.checking)

	create := func(body map[string]any) apitest.Response {
		body["name"], body["target"], body["due_on"] = "New", apitest.BRL(100), "2027-06-30"
		return f.h.Do(http.MethodPost, "/api/v1/goals", body)
	}

	tests := []struct {
		name, field string
		body        map[string]any
	}{
		{
			"allocated over a whole link",
			"allocated_account_ids",
			map[string]any{"allocated_account_ids": []string{f.savings}},
		},
		{
			"whole over an allocated link",
			"account_ids",
			map[string]any{"account_ids": []string{f.checking}},
		},
		{"both in one goal", "allocated_account_ids", map[string]any{
			"account_ids": []string{b.checking}, "allocated_account_ids": []string{b.checking},
		}},
		{
			"account with sub-accounts",
			"allocated_account_ids",
			map[string]any{"allocated_account_ids": []string{b.parent}},
		},
		{
			"account of units",
			"allocated_account_ids",
			map[string]any{"allocated_account_ids": []string{b.fund}},
		},
		{
			"category",
			"allocated_account_ids",
			map[string]any{"allocated_account_ids": []string{f.rent}},
		},
		{"no account", "account_ids", map[string]any{}},
	}
	for _, tt := range tests {
		r := create(tt.body)
		if r.Status != http.StatusUnprocessableEntity {
			t.Errorf("%s: status %d: %s", tt.name, r.Status, r.Body)
			continue
		}

		f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", tt.field)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPatch, "/api/v1/goals/"+whole.ID, map[string]any{
			"allocated_account_ids": []string{f.checking}, "account_ids": []string{f.checking},
		}),
		http.StatusUnprocessableEntity, "validation_failed", "allocated_account_ids",
	)
}

// S582: a schedule with a goal allocates the realized amount of each occurrence to the goal;
// unrealizing deletes the allocation and realizing again keeps one (A255).
func TestS582ScheduleAllocatesToItsGoal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	goal := f.allocatedGoal("Trip", f.savings)
	schedule := f.schedule("savings", f.checking, f.savings, 50000, monthly("2026-11-10", 10, ""),
		map[string]any{"goal_id": goal.ID})

	var created struct {
		GoalID string `json:"goal_id"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+schedule, nil, http.StatusOK, &created)

	if created.GoalID != goal.ID {
		t.Fatalf("schedule goal_id = %q, want %s", created.GoalID, goal.ID)
	}

	if m := f.moves(schedule); m != "spending>goals" {
		t.Errorf("moves = %q, want spending>goals", m)
	}

	f.pay("2026-11-10", 50000, f.savings, "")

	occurrence := f.occurrence(schedule, 1)
	if occurrence.State != "realized" {
		t.Fatalf("occurrence = %+v, want realized", occurrence)
	}

	if got := f.goalByID(goal.ID).Current.Amount; got != 50000 {
		t.Errorf("current after realizing = %d, want 50000", got)
	}

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/occurrences/"+occurrence.ID+"/unrealize",
		nil,
		http.StatusOK,
		nil,
	)

	if got := f.goalByID(goal.ID).Current.Amount; got != 0 {
		t.Errorf("current after unrealizing = %d, want 0", got)
	}

	for _, body := range []map[string]any{
		{"goal_id": f.goal("Whole", 100, f.checking).ID},
		{"goal_id": "00000000-0000-4000-8000-000000000001"},
	} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPost, "/api/v1/schedules", map[string]any{
				"kind": "savings", "account_id": f.checking, "counterpart_id": f.savings,
				"description": "x", "amount": apitest.BRL(100),
				"recurrence": monthly("2026-11-05", 5, ""), "goal_id": body["goal_id"],
			}),
			http.StatusUnprocessableEntity, "validation_failed", "goal_id",
		)
	}
}

// S583: an allocation on a savings account moves its amount from the savings bucket to the goals
// bucket in its month; on a checking account the goals bucket gains it and no bucket loses it;
// the entries of the goals bucket list it without a transaction (A255).
func TestS583AllocationInTheBuckets(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record(
		"2026-09-10",
		apitest.Posting(f.savings, 300000),
		apitest.Posting(f.checking, -300000),
	)
	f.h.Record(
		"2026-09-11",
		apitest.Posting(f.checking, 900000),
		apitest.Posting(f.salary, -900000),
	)
	trip := f.allocatedGoal("Trip", f.savings, f.checking)
	f.allocate(trip.ID, f.savings, 50000, "2026-10-05")
	f.allocate(trip.ID, f.checking, 20000, "2026-10-06")
	f.goalsAndFreedom(f.rent)

	got := f.history("2026-11")
	october := got.Months[4]

	if october.Buckets[1].Real.Amount != 70000 || october.Buckets[2].Real.Amount != -50000 ||
		amountOf(october.Buckets[1].Deposited) != 70000 {
		t.Errorf("october = goals %d (deposited %d) freedom %d, want 70000 70000 -50000",
			october.Buckets[1].Real.Amount, amountOf(october.Buckets[1].Deposited),
			october.Buckets[2].Real.Amount)
	}

	entries := f.entries("2026-10", october.Buckets[1].ID)
	if len(entries.Entries) != 2 || entries.Entries[0].TransactionID != "" ||
		entries.Entries[0].Description != "Trip" || entries.Entries[0].Kind != "goals" ||
		entries.Total.Amount != 70000 {
		t.Errorf("entries of the goals bucket = %+v", entries)
	}
}

// S590: a book in USD with a goal over an allocated BRL account values the allocation at today's
// rate, and the allocation counts in no bucket figure (A255, C2).
func TestS590AllocationInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12", apitest.As(apitest.ForeignBase()))
	f.price(t, "2026-11-10", "5.0000")
	reserve := f.h.Account("Reserva", "asset", "savings", map[string]any{"currency": "BRL"})
	conta := f.h.Account("Conta", "asset", "checking", map[string]any{"currency": "BRL"})
	usd := func(account string, amount int64) map[string]any {
		p := apitest.Posting(account, amount)
		p["weight"] = map[string]any{"amount": amount / 5, "currency": "USD"}

		return p
	}
	f.h.Record("2026-10-01", usd(reserve, 100000), usd(conta, -100000))

	var goal goalView
	f.h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name": "Trip", "target": map[string]any{"amount": 100000, "currency": "USD"},
		"due_on": "2027-06-30", "allocated_account_ids": []string{reserve},
	}, http.StatusCreated, &goal)
	goal = f.allocate(goal.ID, reserve, 50000, "2026-10-05")

	// 500.00 BRL at 5.0000 BRL a dollar.
	if goal.Current.Amount != 10000 || goal.AllocatedAccounts[0].Allocated.Amount != 50000 {
		t.Errorf("goal = current %d allocated %d, want 10000 and 50000",
			goal.Current.Amount, goal.AllocatedAccounts[0].Allocated.Amount)
	}

	f.goalsAndFreedom(f.rent)

	if october := f.history("2026-11").Months[4]; october.Buckets[1].Real.Amount != 0 {
		t.Errorf("goals bucket = %d, want 0", october.Buckets[1].Real.Amount)
	}
}

// S589, allocations: a reader lists and cannot allocate or delete, a writer does both, a request
// without a session is rejected and a goal of another book is not found (B2).
func TestGoalAllocationRoles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	car, _ := f.sharedAccount()
	path := allocationsPath(car.ID)
	body := map[string]any{"account_id": f.savings, "amount": apitest.BRL(100)}
	missing := path + "/00000000-0000-4000-8000-000000000001"

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPost, path, body),
		http.StatusForbidden, "book_role_required", "",
	)
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodDelete, missing, nil),
		http.StatusForbidden, "book_role_required", "",
	)

	if r := f.h.Call(reader, http.MethodGet, path, nil); r.Status != http.StatusOK {
		t.Errorf("reader GET = %d: %s", r.Status, r.Body)
	}

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.h.Call(writer, http.MethodPost, path, body); r.Status != http.StatusOK {
		t.Errorf("writer POST = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(writer, http.MethodDelete, missing, nil),
		http.StatusNotFound, "not_found", "",
	)

	for _, method := range []string{http.MethodGet, http.MethodPost} {
		f.h.ExpectProblem(
			f.h.Call(&http.Client{}, method, path, body),
			http.StatusUnauthorized, "unauthenticated", "",
		)
	}

	other := f.h.Login("other@example.com")
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodGet, path, nil),
		http.StatusNotFound, "not_found", "",
	)
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodPost, path, body),
		http.StatusNotFound, "not_found", "",
	)
}

// The database rejects an allocation without a book, one of zero, one on an account the goal
// does not hold and a second allocation of one occurrence (planning coherence B1).
func TestGoalAllocationSchema(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	goal := f.allocatedGoal("Trip", f.savings)
	schedule := f.schedule(
		"savings",
		f.checking,
		f.savings,
		50000,
		monthly("2026-11-10", 10, ""),
		nil,
	)
	occurrence := f.occurrence(schedule, 1)
	book := f.h.OwnerID()

	insert := func(books any, account string, amount int64, occurrenceID any) error {
		_, err := f.h.Pool.Exec(
			t.Context(),
			`INSERT INTO planning_goal_allocation
				(books_id, goal_id, account_id, booked_on, amount, occurrence_id)
			VALUES ($1, $2, $3, '2026-11-10', $4, $5)`,
			books, goal.ID, account, amount, occurrenceID,
		)

		return err
	}
	if err := insert(book, f.savings, 100, occurrence.ID); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		err  error
	}{
		{"without a book", insert(nil, f.savings, 100, nil)},
		{"amount of zero", insert(book, f.savings, 0, nil)},
		{"account the goal does not hold", insert(book, f.checking, 100, nil)},
		{"second allocation of one occurrence", insert(book, f.savings, 100, occurrence.ID)},
	}
	for _, tt := range tests {
		if tt.err == nil {
			t.Errorf("%s: the database accepted the row", tt.name)
		}
	}
}

// The assistant sets money aside for a goal through manage_budget_or_goal, previewed first; an
// amount above what the account has available is refused (planning coherence S4).
func TestGoalAllocationTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	car, _ := f.sharedAccount()
	args := map[string]any{
		"action": "allocate", "goal_id": car.ID, "account_ids": []string{f.savings},
		"amount": "-1000.00",
	}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	if p.Action != "manage_budget_or_goal.allocate" || p.Target != "Car" || len(p.Changes) != 2 ||
		p.Changes[1].After.Amount != "-1000.00" {
		t.Errorf("preview = %+v", p)
	}

	var out toolManaged
	toolOutput(t, f.h, "manage_budget_or_goal", args, &out)

	if got := f.goalByID(car.ID).Current.Amount; got != 1900000 {
		t.Errorf("current after the release = %d, want 1900000", got)
	}

	args["amount"] = "7000.00"
	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", args), "validation_failed", "amount")
}
