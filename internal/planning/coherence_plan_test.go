package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type movesView struct {
	Moves *struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"moves"`
}

// moves returns the sets the schedule moves money between, "" for a schedule without them.
func (f fixture) moves(schedule string) string {
	f.h.T().Helper()

	var out movesView
	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+schedule, nil, http.StatusOK, &out)

	if out.Moves == nil {
		return ""
	}

	return out.Moves.From + ">" + out.Moves.To
}

// S567: a schedule of kind transfer from checking into a brokerage account counts as savings:
// the plan holds it, the bucket that takes savings plans it and the schedule moves from the
// spending set to the savings set (planning coherence A253).
func TestS567TransferIntoABrokerageAccountIsSavings(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	broker := f.h.Account("Broker", "asset", "brokerage", nil)
	transfer := f.schedule(
		"transfer",
		f.checking,
		broker,
		100000,
		monthly("2026-11-20", 20, ""),
		nil,
	)
	bill := f.rentSchedule()
	f.goalsAndFreedom(f.rent)

	got := f.bucketPlan("2026-11")

	if got.Savings.Amount != 100000 || amountOf(got.SavingsBrokerage) != 100000 ||
		amountOf(got.GoalDeposits) != 0 || amountOf(got.GoalDepositsBrokerage) != 0 {
		t.Errorf("plan = savings %d brokerage %d goal deposits %d, want 100000 100000 0",
			got.Savings.Amount, amountOf(got.SavingsBrokerage), amountOf(got.GoalDeposits))
	}

	if got.Buckets[2].Planned.Amount != 100000 || got.Buckets[1].Planned.Amount != 0 {
		t.Errorf("planned freedom %d goals %d, want 100000 0",
			got.Buckets[2].Planned.Amount, got.Buckets[1].Planned.Amount)
	}

	if m := f.moves(transfer); m != "spending>savings" {
		t.Errorf("moves = %q, want spending>savings", m)
	}

	if m := f.moves(bill); m != "" {
		t.Errorf("moves of a bill = %q, want none", m)
	}
}

// S568: a schedule of kind savings into the account of a goal counts as a goal deposit and not as
// savings; with a goal that counts as savings the figures swap (A253).
func TestS568SavingsScheduleIntoAGoalAccount(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	goal := f.goal("Trip", 1000000, trip)
	schedule := f.schedule("savings", f.checking, trip, 50000, monthly("2026-11-20", 20, ""), nil)
	f.goalsAndFreedom(f.rent)

	got := f.bucketPlan("2026-11")

	if amountOf(got.GoalDeposits) != 50000 || got.Savings.Amount != 0 ||
		got.Buckets[1].Planned.Amount != 50000 || got.Buckets[2].Planned.Amount != 0 {
		t.Errorf("plan = goal deposits %d savings %d goals %d freedom %d, want 50000 0 50000 0",
			amountOf(got.GoalDeposits), got.Savings.Amount,
			got.Buckets[1].Planned.Amount, got.Buckets[2].Planned.Amount)
	}

	if m := f.moves(schedule); m != "spending>goals" {
		t.Errorf("moves = %q, want spending>goals", m)
	}

	f.h.MustDo(
		http.MethodPatch,
		"/api/v1/goals/"+goal.ID,
		map[string]any{"counts_as_savings": true},
		http.StatusOK,
		nil,
	)

	got = f.bucketPlan("2026-11")

	if amountOf(got.GoalDeposits) != 0 || got.Savings.Amount != 50000 ||
		got.Buckets[1].Planned.Amount != 0 || got.Buckets[2].Planned.Amount != 50000 {
		t.Errorf("counting as savings = goal deposits %d savings %d, want 0 50000",
			amountOf(got.GoalDeposits), got.Savings.Amount)
	}

	if m := f.moves(schedule); m != "spending>savings" {
		t.Errorf("moves = %q, want spending>savings", m)
	}
}

// S569: a schedule from a savings account to checking lowers the savings; one between two savings
// accounts counts nothing (A253).
func TestS569MovementOutOfAndInsideTheSavingsSet(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	spare := f.h.Account("Spare", "asset", "reserve", nil)
	f.schedule("savings", f.checking, f.savings, 100000, monthly("2026-11-20", 20, ""), nil)
	out := f.schedule("transfer", f.savings, f.checking, 30000, monthly("2026-11-21", 21, ""), nil)
	inside := f.schedule("transfer", f.savings, spare, 20000, monthly("2026-11-22", 22, ""), nil)

	got := f.plan("2026-11")

	if got.Savings.Amount != 70000 || amountOf(got.SavingsBrokerage) != 0 {
		t.Errorf("savings = %d brokerage %d, want 70000 0",
			got.Savings.Amount, amountOf(got.SavingsBrokerage))
	}

	if m := f.moves(out); m != "savings>spending" {
		t.Errorf("moves out = %q, want savings>spending", m)
	}

	if m := f.moves(inside); m != "savings>savings" {
		t.Errorf("moves inside = %q, want savings>savings", m)
	}
}

// S570: unassigned is reference − installments − savings − goal deposits − planned (A253).
func TestS570UnassignedSubtractsGoalDeposits(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	f.goal("Trip", 1000000, trip)
	f.schedule("savings", f.checking, trip, 50000, monthly("2026-11-20", 20, ""), nil)
	f.schedule("savings", f.checking, f.savings, 70000, monthly("2026-11-21", 21, ""), nil)
	f.budget(f.rent, 200000, "2026-11", false)

	got := f.savePlan("2026-11", map[string]any{
		"source": "fixed", "fixed": apitest.BRL(500000), "amounts": []any{},
	})

	// 5000.00 − 0 − 700.00 − 500.00 − 2000.00.
	if amountOf(got.Unassigned) != 180000 {
		t.Errorf("unassigned = %d, want 180000", amountOf(got.Unassigned))
	}
}
