package planning_test

import "testing"

// A127 skips the occurrences dated before a schedule's creation; the creation date comes from the
// application clock, so an occurrence after today stays expected whatever the wall clock reads.
func TestScheduleCreatedOnTheClockDate(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2020-01-10")
	id := f.schedule("bill", f.checking, f.rent, 100000, monthly("2020-01-15", 15, ""), nil)

	got := f.occurrences("from=2020-01-01&to=2020-01-31&schedule_id=" + id)
	if len(got) != 1 || got[0].ExpectedOn != "2020-01-15" || got[0].State != "expected" {
		t.Fatalf("occurrences = %+v", got)
	}
}

// An explicit paying transaction realizes the occurrence on the rule's first date before the A127
// pass, whatever its amount; a later past occurrence that none realizes is still skipped.
func TestScheduleCreatedWithPayingTransaction(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	tx := f.pay("2026-10-06", 100000, f.rent, "")

	var out toolSchedule
	toolOutput(t, f.h, "manage_schedule", map[string]any{
		"action": "create", "kind": "bill", "description": "Rent", "account_id": f.checking, "counterpart_id": f.rent,
		"amount": "2100.00", "frequency": "monthly", "day_of_month": 5, "start": "2026-10-05",
		"paid_by_transaction_id": tx,
	}, &out)

	got := f.occurrences("from=2026-10-01&to=2026-11-30&schedule_id=" + out.ScheduleID)
	if len(got) != 2 || got[0].State != "realized" || got[0].TransactionID != tx || got[1].State != "skipped" {
		t.Fatalf("occurrences = %+v", got)
	}
}
