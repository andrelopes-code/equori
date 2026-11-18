package planning_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// systemCategory returns the id of the book's category with the system role.
func (f fixture) systemCategory(role string) string {
	f.h.T().Helper()

	rows := f.h.Rows(`SELECT id::text FROM ledger_account WHERE system_role = $1`, role)
	if len(rows) != 1 {
		f.h.T().Fatalf("system category %s = %v", role, rows)
	}

	return rows[0]
}

// goalsAndFreedom saves a split with a ceiling bucket, the bucket that takes goals and the
// bucket that takes savings, in that order.
func (f fixture) goalsAndFreedom(categories ...string) {
	f.h.T().Helper()

	goals := bucket("Goals", 2000, false)
	goals["takes_goals"] = true
	f.saveBuckets(bucket("Needs", 5000, false, categories...), goals, bucket("Freedom", 3000, true))
}

// S571: an expense paid from a goal account lowers the goals bucket as a withdrawal to checking
// of the same amount does (planning coherence A251).
func TestS571ExpensePaidFromAGoalAccount(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	trip := f.h.Account("Trip", "asset", "savings", nil)
	other := f.h.Account("Other trip", "asset", "savings", nil)
	travel := f.h.Account("Travel", "expense", "", nil)
	f.goal("Trip", 1000000, trip)
	f.goal("Other trip", 1000000, other)
	f.h.Record("2026-09-10", apitest.Posting(trip, 500000), apitest.Posting(f.checking, -500000))
	f.h.Record("2026-10-10", apitest.Posting(travel, 500000), apitest.Posting(trip, -500000))
	f.h.Record("2026-08-10", apitest.Posting(other, 500000), apitest.Posting(f.checking, -500000))
	f.h.Record("2026-11-02", apitest.Posting(f.checking, 500000), apitest.Posting(other, -500000))
	f.goalsAndFreedom(travel)

	got := f.history("2026-11")

	// Months run from 2026-06: August is index 2, September 3, October 4, November 5.
	want := map[int]int64{2: 500000, 3: 500000, 4: -500000, 5: -500000}
	for i, w := range want {
		if goals := got.Months[i].Buckets[1].Real.Amount; goals != w {
			t.Errorf("%s goals = %d, want %d", got.Months[i].Month, goals, w)
		}
	}
}

// S572: a salary credited to a savings account counts in the income received and in the bucket
// that takes savings (A251).
func TestS572SalaryCreditedToASavingsAccount(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record("2026-10-05", apitest.Posting(f.savings, 500000), apitest.Posting(f.salary, -500000))
	f.goalsAndFreedom(f.rent)

	october := f.history("2026-11").Months[4]

	if october.Received.Amount != 500000 || october.Buckets[2].Real.Amount != 500000 {
		t.Errorf("received %d freedom %d, want 500000 500000",
			october.Received.Amount, october.Buckets[2].Real.Amount)
	}
}

// S573: a yield credited to a brokerage account is retained: outside the income received and
// no deposit. The same yield credited to checking stays in the income received (A252).
func TestS573RetainedYield(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	yield := f.systemCategory("yield")
	broker := f.h.Account("Broker", "asset", "brokerage", nil)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.h.Record("2026-10-20", apitest.Posting(broker, 30000), apitest.Posting(yield, -30000))
	f.h.Record("2026-09-20", apitest.Posting(f.checking, 7000), apitest.Posting(yield, -7000))
	f.goalsAndFreedom(f.rent)

	got := f.history("2026-11")
	september, october := got.Months[3], got.Months[4]

	if amountOf(october.Retained) != 30000 || october.Received.Amount != 500000 ||
		october.Buckets[2].Real.Amount != 0 || amountOf(october.Unallocated) != 500000 {
		t.Errorf("october = %+v, want retained 30000, received 500000, freedom 0", october)
	}

	if amountOf(september.Retained) != 0 || september.Received.Amount != 7000 {
		t.Errorf("september = %+v, want retained 0, received 7000", september)
	}
}

// S574: a realized loss posted from a brokerage account counts no withdrawal (A251).
func TestS574RealizedLossIsNoWithdrawal(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	losses := f.systemCategory("realized_losses")
	broker := f.h.Account("Broker", "asset", "brokerage", nil)
	f.h.Record("2026-09-10", apitest.Posting(broker, 100000), apitest.Posting(f.checking, -100000))
	f.h.Record("2026-10-10", apitest.Posting(losses, 20000), apitest.Posting(broker, -20000))
	f.goalsAndFreedom(f.rent)

	got := f.history("2026-11")

	if sep, oct := got.Months[3].Buckets[2].Real.Amount, got.Months[4].Buckets[2].Real.Amount; sep != 100000 ||
		oct != 0 {
		t.Errorf("freedom september %d october %d, want 100000 0", sep, oct)
	}
}
