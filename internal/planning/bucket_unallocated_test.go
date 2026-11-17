package planning_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S530: the income neither spent nor moved into the savings accounts is the unallocated amount
// of the month; a withdrawal from savings in a month without income counts positive (A235).
func TestS530UnallocatedIncome(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 300000, f.rent, "")
	f.pay("2026-10-20", 80000, f.savings, "")
	f.h.Record(
		"2026-11-03",
		apitest.Posting(f.checking, 20000),
		apitest.Posting(f.savings, -20000),
	)
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), bucket("Freedom", 5000, true))

	got := f.history("2026-11")

	// Months run from 2026-06: October is index 4, November 5.
	want := map[int]int64{4: 120000, 5: 20000}
	for i, w := range want {
		if u := got.Months[i].Unallocated; u == nil || u.Amount != w {
			t.Errorf("month %d unallocated = %+v, want %d", i, u, w)
		}
	}

	var out struct {
		Split []struct {
			Unallocated toolAmount `json:"unallocated"`
		} `json:"split"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-11", "kind": "split"},
		&out,
	)

	if len(out.Split) != 6 || out.Split[4].Unallocated.Amount != "1200.00" {
		t.Errorf("tool split = %+v, want 1200.00 unallocated in October", out.Split)
	}
}

// S531: with a savings bucket, a goals bucket and spending outside the split, the real amounts,
// outside and unallocated sum to the income received in every month; a goal withdrawal counts
// once, in the goals bucket (A235).
func TestS531UnallocatedClosesTheMonth(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	gym := f.h.Account("Gym", "expense", "", nil)
	reserve := f.h.Account("Reserve", "asset", "savings", nil)
	f.goal("Emergency", 1000000, reserve)
	f.h.Record(
		"2026-08-10",
		apitest.Posting(reserve, 200000),
		apitest.Posting(f.checking, -200000),
	)
	f.h.Record(
		"2026-09-05",
		apitest.Posting(f.checking, 288000),
		apitest.Posting(f.salary, -288000),
	)
	f.pay("2026-09-06", 400000, f.rent, "")
	f.pay("2026-09-07", 24900, gym, "")
	f.h.Record(
		"2026-09-15",
		apitest.Posting(f.checking, 158200),
		apitest.Posting(reserve, -158200),
	)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 100000, f.rent, "")
	f.pay("2026-10-12", 100000, f.savings, "")

	goals := bucket("Goals", 2000, false)
	goals["takes_goals"] = true
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), goals, bucket("Freedom", 3000, true))

	got := f.history("2026-11")

	for _, m := range got.Months {
		if m.Unallocated == nil {
			t.Fatalf("month %s has no unallocated", m.Month)
		}

		sum := m.Outside.Amount + m.Unallocated.Amount
		for _, b := range m.Buckets {
			sum += b.Real.Amount
		}

		if sum != m.Received.Amount {
			t.Errorf("month %s sums to %d, want the received %d", m.Month, sum, m.Received.Amount)
		}
	}

	// September: 2,880.00 received, 4,249.00 spent, 1,582.00 withdrawn from the goal.
	if u := got.Months[3].Unallocated.Amount; u != 21300 {
		t.Errorf("september unallocated = %d, want 21300", u)
	}
}
