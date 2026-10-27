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
