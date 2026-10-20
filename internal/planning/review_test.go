package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Final review, finding 1: a preceding adjustment may move the first date before start;
// that occurrence is generated.
func TestPrecedingDateBeforeStartIsGenerated(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-25")
	id := f.schedule("bill", f.checking, f.rent, 10000, monthly("2026-11-01", 1, "preceding"), nil)
	got := f.occurrences("from=2026-10-01&to=2026-12-30&schedule_id=" + id)
	if len(got) != 2 || got[0].ExpectedOn != "2026-10-30" || got[0].Sequence != 1 || got[1].ExpectedOn != "2026-12-01" {
		t.Fatalf("occurrences = %+v", got)
	}
}

// Final review, finding 2: a rule change after a realized occurrence dated on or after the
// effective date keeps the new rule's first date.
func TestRuleChangeAfterAnEarlyPayment(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 10, ""), nil)
	tx := f.pay("2026-11-04", 210000, f.rent, "")
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{
		"effective_from": "2026-11-05", "recurrence": map[string]any{"frequency": "monthly", "interval": 1, "day_of_month": 1, "start": "2026-11-05"},
	}, http.StatusCreated, nil)
	got := f.bySequence(id, "2026-11-01", "2027-01-31")
	if o := got[1]; o.ExpectedOn != "2026-11-10" || o.State != "realized" || o.TransactionID != tx {
		t.Errorf("sequence 1 = %+v", o)
	}
	if o := got[2]; o.ExpectedOn != "2026-12-01" || o.State != "expected" {
		t.Errorf("sequence 2 = %+v, want 2026-12-01", o)
	}
	if o := got[3]; o.ExpectedOn != "2027-01-01" {
		t.Errorf("sequence 3 = %+v, want 2027-01-01", o)
	}
	// A later tick keeps the numbering of the new version.
	f.h.Restart(apitest.Today("2026-12-15"))
	f.h.App.Planning.Tick(t.Context())
	later := f.bySequence(id, "2027-11-02", "2027-12-31")
	if o, ok := later[14]; !ok || o.ExpectedOn != "2027-12-01" || len(later) != 1 {
		t.Errorf("after the tick = %+v, want sequence 14 on 2027-12-01", later)
	}
}

// Final review, finding 3: a terms change effective before the schedule existed creates no
// occurrence dated before its creation.
func TestTermsChangeBeforeCreation(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-01-05", 5, ""), nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2026-02-01", "amount": apitest.BRL(220000)}, http.StatusCreated, nil)
	if past := f.occurrences("from=2026-01-01&to=2026-10-31&schedule_id=" + id); len(past) != 0 {
		t.Fatalf("occurrences before creation = %v", dates(past))
	}
	if o := f.bySequence(id, "2026-11-01", "2026-11-30")[11]; o.ExpectedOn != "2026-11-05" || o.ExpectedAmount.Amount != 220000 {
		t.Fatalf("2026-11 = %+v", o)
	}
}

// Final review, finding 4: an automatic realization the owner releases is not restored by the
// next event of the same transaction.
func TestUnrealizedMatchStaysReleased(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	wrong := f.pay("2026-11-05", 210000, f.rent, f.landlord)
	occ := f.occurrence(id, 1)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/unrealize", nil, http.StatusOK, nil)
	f.h.MustDo(http.MethodPut, "/api/v1/transactions/"+wrong, map[string]any{
		"date": "2026-11-05", "description": "fixed", "expected_version": 1, "reason": "description", "payee_id": f.landlord,
		"postings": []any{apitest.Posting(f.checking, -210000), apitest.Posting(f.rent, 210000)},
	}, http.StatusOK, nil)
	f.h.Dispatch()
	if o := f.occurrence(id, 1); o.State != "expected" {
		t.Fatalf("after the correction = %+v, want expected", o)
	}
	right := f.pay("2026-11-20", 210000, f.rent, "")
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/realize", map[string]string{"transaction_id": right}, http.StatusOK, nil)
}

// Final review, finding 7: budget progress is bounded by the horizon.
func TestBudgetProgressBeyondHorizon(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-12-01")
	id := f.budget(f.rent, 100000, "2026-10", true)
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/budgets/"+id+"/progress?month=2028-01", nil), http.StatusUnprocessableEntity, "validation_failed", "month")
	f.h.MustDo(http.MethodGet, "/api/v1/budgets/"+id+"/progress?month=2027-12", nil, http.StatusOK, nil)
}
