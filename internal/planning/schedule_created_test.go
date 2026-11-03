package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

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

// The paying transaction passes the checks of a manual link; a refused creation stores no schedule.
func TestScheduleCreatedWithRefusedPayingTransaction(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	args := func(tx string) map[string]any {
		return map[string]any{
			"action": "create", "kind": "bill", "description": "Rent", "account_id": f.checking, "counterpart_id": f.rent,
			"amount": "2100.00", "frequency": "monthly", "day_of_month": 5, "start": "2026-10-05",
			"paid_by_transaction_id": tx,
		}
	}
	elsewhere := f.h.Account("Other expense", "expense", "", nil)

	var other struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-06", "description": "elsewhere",
		"postings": []any{apitest.Posting(f.savings, -1000), apitest.Posting(elsewhere, 1000)},
	}, http.StatusCreated, &other)

	paid := f.pay("2026-10-06", 100000, f.rent, "")
	var first toolSchedule
	toolOutput(t, f.h, "manage_schedule", args(paid), &first)

	f.h.ExpectToolError(f.h.Tool("manage_schedule", args(other.ID)), "validation_failed", "paid_by_transaction_id")
	f.h.ExpectToolError(f.h.Tool("manage_schedule", args(paid)), "transaction_in_use", "")

	var got toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{}, &got)

	if len(got.Schedules) != 1 || got.Schedules[0].ScheduleID != first.ScheduleID {
		t.Fatalf("schedules = %+v, want only the first", got.Schedules)
	}
}
