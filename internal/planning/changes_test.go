package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func (f fixture) bySequence(scheduleID, from, to string) map[int]occurrenceView {
	f.h.T().Helper()
	out := map[int]occurrenceView{}
	for _, o := range f.occurrences("from=" + from + "&to=" + to + "&schedule_id=" + scheduleID) {
		if _, dup := out[o.Sequence]; dup {
			f.h.T().Fatalf("sequence %d appears twice", o.Sequence)
		}
		out[o.Sequence] = o
	}
	return out
}

// Review Focus 1: a terms change keeps realized, skipped and moved occurrences; a rule
// change continues the sequence (P7 amendments A49, A52).
func TestTermsChangeKeepsClosedOccurrences(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	tx := f.pay("2026-11-05", 210000, f.rent, f.landlord)
	dec, jan := f.occurrence(id, 2), f.occurrence(id, 3)
	var skipped, moved occurrenceView
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+dec.ID+"/skip", map[string]string{"reason": "paid in advance"}, http.StatusOK, &skipped)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+jan.ID+"/move", map[string]string{"date": "2027-01-08"}, http.StatusOK, &moved)
	if skipped.State != "skipped" || moved.ExpectedOn != "2027-01-08" || moved.MovedFrom != "2027-01-05" || moved.State != "expected" {
		t.Fatalf("skipped = %+v, moved = %+v", skipped, moved)
	}
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2026-12-01", "amount": apitest.BRL(230000)}, http.StatusCreated, nil)
	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	if o := got[1]; o.State != "realized" || o.TransactionID != tx || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 1 = %+v", o)
	}
	if o := got[2]; o.State != "skipped" || o.ExpectedOn != "2026-12-07" || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 2 = %+v", o)
	}
	if o := got[3]; o.ExpectedOn != "2027-01-08" || o.MovedFrom != "2027-01-05" || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 3 = %+v", o)
	}
	if o := got[4]; o.ExpectedOn != "2027-02-05" || o.ExpectedAmount.Amount != 230000 {
		t.Errorf("sequence 4 = %+v", o)
	}
	if len(got) != 12 {
		t.Errorf("occurrences = %d, want 12", len(got))
	}

	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{
		"effective_from": "2027-03-01", "recurrence": map[string]any{"frequency": "monthly", "interval": 1, "day_of_month": 10, "start": "2027-03-01"},
	}, http.StatusCreated, nil)
	got = f.bySequence(id, "2026-11-01", "2027-10-31")
	if o := got[5]; o.ExpectedOn != "2027-03-10" || o.ExpectedAmount.Amount != 230000 {
		t.Errorf("sequence 5 after the rule change = %+v", o)
	}
	if o := got[12]; o.ExpectedOn != "2027-10-10" {
		t.Errorf("sequence 12 after the rule change = %+v", o)
	}
	var sch struct {
		Terms []struct {
			EffectiveFrom string `json:"effective_from"`
		} `json:"terms"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+id, nil, http.StatusOK, &sch)
	if len(sch.Terms) != 3 || sch.Terms[2].EffectiveFrom != "2027-03-01" {
		t.Errorf("terms = %+v", sch.Terms)
	}
}

// Review Focus 5: count holds across horizon extensions.
func TestCountAcrossHorizonExtensions(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	r := monthly("2026-11-01", 5, "")
	r["count"] = 14
	id := f.schedule("bill", f.checking, f.rent, 10000, r, nil)
	for _, today := range []string{"2027-01-15", "2027-06-01", "2028-01-01"} {
		f.h.Restart(apitest.Today(today))
		f.h.App.Planning.Tick(t.Context())
	}
	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	later := f.bySequence(id, "2027-11-01", "2028-10-31")
	if len(got)+len(later) != 14 || later[14].ExpectedOn != "2027-12-05" {
		t.Fatalf("occurrences = %d + %d, last = %+v", len(got), len(later), later[14])
	}
}

func TestChangesConflicts(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-05", 210000, f.rent, f.landlord)
	realized := f.occurrence(id, 1)
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+realized.ID+"/skip", map[string]string{}), http.StatusConflict, "occurrence_closed", "")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+realized.ID+"/move", map[string]string{"date": "2026-11-06"}), http.StatusConflict, "occurrence_closed", "")
	skipped := f.occurrence(id, 2)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+skipped.ID+"/skip", map[string]string{}, http.StatusOK, nil)
	tx := f.pay("2026-12-20", 210000, f.rent, "")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+skipped.ID+"/realize", map[string]string{"transaction_id": tx}), http.StatusConflict, "occurrence_closed", "")

	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/pauses", map[string]string{"from": "2027-02-01", "to": "2027-03-31"}, http.StatusCreated, nil)
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/pauses", map[string]string{"from": "2027-03-01", "to": "2027-04-30"}), http.StatusConflict, "pause_overlap", "")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/pauses", map[string]string{"from": "2027-05-02", "to": "2027-05-01"}), http.StatusUnprocessableEntity, "validation_failed", "to")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2027-01-01"}), http.StatusUnprocessableEntity, "validation_failed", "amount")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2026-11-01", "amount": apitest.BRL(1)}), http.StatusUnprocessableEntity, "validation_failed", "effective_from")

	var ended struct {
		EndsOn string `json:"ends_on"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/end", map[string]string{"from": "2027-06-01"}, http.StatusOK, &ended)
	if ended.EndsOn != "2027-06-01" {
		t.Fatalf("ends_on = %q", ended.EndsOn)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2027-07-01", "amount": apitest.BRL(1)}), http.StatusConflict, "schedule_ended", "")
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules/"+id+"/pauses", map[string]string{"from": "2027-08-01", "to": "2027-08-31"}), http.StatusConflict, "schedule_ended", "")
	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	if o, ok := got[1]; !ok || o.State != "realized" {
		t.Errorf("the realized occurrence did not survive the end: %+v", got)
	}
	for seq, o := range got {
		if o.ExpectedOn >= "2027-06-01" {
			t.Errorf("sequence %d on %s survives the end", seq, o.ExpectedOn)
		}
		if o.ExpectedOn >= "2027-02-01" && o.ExpectedOn <= "2027-03-31" {
			t.Errorf("sequence %d on %s survives the pause", seq, o.ExpectedOn)
		}
	}
	f.h.Restart(apitest.Today("2027-02-01"))
	f.h.App.Planning.Tick(t.Context())
	if later := f.bySequence(id, "2027-06-01", "2028-05-31"); len(later) != 0 {
		t.Errorf("a tick after the end generated %+v", later)
	}
}
