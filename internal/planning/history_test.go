package planning_test

import (
	"slices"
	"testing"
)

func states(os []occurrenceView) []string {
	out := make([]string, len(os))
	for i, o := range os {
		out[i] = o.State
	}
	return out
}

// S143 (A127): a schedule whose rule starts before its creation has its earlier occurrences, and the
// transactions already recorded realize them.
func TestScheduleStartingBeforeCreationRealizesRecordedTransactions(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	july := f.pay("2026-07-30", 2390, f.rent, "")
	august := f.pay("2026-08-30", 2390, f.rent, "")
	september := f.pay("2026-09-29", 2390, f.rent, "")
	id := f.schedule("subscription", f.checking, f.rent, 2390, monthly("2026-07-30", 30, ""), nil)
	got := f.occurrences("from=2026-07-01&to=2026-11-30&schedule_id=" + id)
	if want := []string{"2026-07-30", "2026-08-30", "2026-09-30", "2026-10-30", "2026-11-30"}; !slices.Equal(dates(got), want) {
		t.Fatalf("dates = %v, want %v", dates(got), want)
	}
	if want := []string{"realized", "realized", "realized", "expected", "expected"}; !slices.Equal(states(got), want) {
		t.Fatalf("states = %v, want %v", states(got), want)
	}
	if got[0].TransactionID != july || got[1].TransactionID != august || got[2].TransactionID != september {
		t.Fatalf("transactions = %v %v %v", got[0].TransactionID, got[1].TransactionID, got[2].TransactionID)
	}
}

// S143 (A127): an occurrence dated before the schedule's creation that no recorded transaction
// realizes is skipped, so it is never overdue nor projected.
func TestUnrealizedOccurrenceBeforeCreationIsSkipped(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	id := f.schedule("income", f.checking, f.salary, 500000, monthly("2026-09-05", 5, ""), nil)
	got := f.occurrences("from=2026-09-01&to=2026-11-30&schedule_id=" + id)
	if want := []string{"2026-09-05", "2026-10-05", "2026-11-05"}; !slices.Equal(dates(got), want) {
		t.Fatalf("dates = %v, want %v", dates(got), want)
	}
	if want := []string{"skipped", "skipped", "expected"}; !slices.Equal(states(got), want) {
		t.Fatalf("states = %v, want %v", states(got), want)
	}
}

// S143 (A127): a schedule created while occurrences started at creation gets its earlier occurrences
// from a backfill, which realizes and skips them as creation does.
func TestBackfillRebuildsTheHistoryOfAnExistingSchedule(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	paid := f.pay("2026-08-16", 1990, f.rent, "")
	id := f.schedule("subscription", f.checking, f.rent, 1990, monthly("2026-07-16", 16, ""), nil)
	if _, err := f.h.Pool.Exec(t.Context(), `DELETE FROM planning_occurrence WHERE schedule_id = $1 AND expected_on < '2026-10-20'`, id); err != nil {
		t.Fatal(err)
	}
	if err := f.h.App.Planning.Backfill(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := f.h.App.Planning.Backfill(t.Context()); err != nil {
		t.Fatalf("second backfill: %v", err)
	}
	got := f.occurrences("from=2026-07-01&to=2026-11-30&schedule_id=" + id)
	if want := []string{"2026-07-16", "2026-08-16", "2026-09-16", "2026-10-16", "2026-11-16"}; !slices.Equal(dates(got), want) {
		t.Fatalf("dates = %v, want %v", dates(got), want)
	}
	if want := []string{"skipped", "realized", "skipped", "skipped", "expected"}; !slices.Equal(states(got), want) {
		t.Fatalf("states = %v, want %v", states(got), want)
	}
	if got[1].TransactionID != paid {
		t.Fatalf("august transaction = %q, want %q", got[1].TransactionID, paid)
	}
}
