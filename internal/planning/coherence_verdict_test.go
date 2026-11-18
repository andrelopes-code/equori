package planning_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S575: a rollover budget of 200.00 a month with 2,200.00 carried pays 2,400.00 in one month:
// 2,200.00 are covered by the accumulated balance and the bucket counts 200.00 against its
// target (planning coherence A254).
func TestS575AccumulatedBalanceCoversTheBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	insurance := f.h.Account("Insurance", "expense", "", nil)
	f.budget(insurance, 20000, "2025-11", true)
	f.pay("2026-10-06", 240000, insurance, "")
	f.goalsAndFreedom(insurance)

	october := f.history("2026-11").Months[4]

	if october.Buckets[0].Real.Amount != 240000 || amountOf(october.Buckets[0].Covered) != 220000 {
		t.Errorf("needs = real %d covered %d, want 240000 220000",
			october.Buckets[0].Real.Amount, amountOf(october.Buckets[0].Covered))
	}

	if amountOf(october.Buckets[2].Covered) != 0 {
		t.Errorf("freedom covered = %d, want 0", amountOf(october.Buckets[2].Covered))
	}
}

// S576: a carried amount below zero covers nothing; a budget without rollover covers nothing
// (A254).
func TestS576OverspentBudgetCoversNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	fun := f.h.Account("Fun", "expense", "", nil)
	f.budget(f.rent, 20000, "2026-09", true)
	f.budget(fun, 20000, "2026-06", false)
	f.pay("2026-09-06", 50000, f.rent, "")
	f.pay("2026-10-06", 10000, f.rent, "")
	f.pay("2026-10-07", 30000, fun, "")
	f.goalsAndFreedom(f.rent, fun)

	october := f.history("2026-11").Months[4]

	if october.Buckets[0].Real.Amount != 40000 || amountOf(october.Buckets[0].Covered) != 0 {
		t.Errorf("needs = real %d covered %d, want 40000 0",
			october.Buckets[0].Real.Amount, amountOf(october.Buckets[0].Covered))
	}
}

// S577: the bucket that takes goals states what was deposited and what was withdrawn beside the
// net amount (A254).
func TestS577GoalsBucketDepositedAndWithdrawn(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	f.goal("Trip", 1000000, trip)
	f.h.Record("2026-09-10", apitest.Posting(trip, 600000), apitest.Posting(f.checking, -600000))
	f.h.Record("2026-10-05", apitest.Posting(trip, 50000), apitest.Posting(f.checking, -50000))
	f.h.Record("2026-10-20", apitest.Posting(f.checking, 500000), apitest.Posting(trip, -500000))
	f.goalsAndFreedom(f.rent)

	october := f.history("2026-11").Months[4]
	goals, needs := october.Buckets[1], october.Buckets[0]

	if goals.Real.Amount != -450000 || amountOf(goals.Deposited) != 50000 ||
		amountOf(goals.Withdrawn) != 500000 {
		t.Errorf("goals = real %d deposited %d withdrawn %d, want -450000 50000 500000",
			goals.Real.Amount, amountOf(goals.Deposited), amountOf(goals.Withdrawn))
	}

	if needs.Deposited != nil || needs.Withdrawn != nil {
		t.Errorf("needs = %+v, want no deposited and no withdrawn", needs)
	}
}
