package planning_test

import "testing"

// S27: the rent PIX of 2026-11-05 realizes the 2026-11 occurrence.
func TestS27MonthlyRent(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	tx := f.pay("2026-11-05", 210000, f.rent, f.landlord)
	f.h.Dispatch()
	got := f.occurrences("from=2026-11-01&to=2027-01-31&schedule_id=" + id)
	if len(got) != 3 {
		t.Fatalf("occurrences = %+v", got)
	}
	if got[0].State != "realized" || got[0].TransactionID != tx {
		t.Errorf("2026-11 = %+v, want realized by %s", got[0], tx)
	}
	for _, o := range got[1:] {
		if o.State != "expected" || o.TransactionID != "" {
			t.Errorf("%s = %+v, want expected", o.ExpectedOn, o)
		}
	}
}
