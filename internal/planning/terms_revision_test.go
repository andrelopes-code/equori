package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type termsView struct {
	Terms []struct {
		EffectiveFrom string `json:"effective_from"`
		Amount        struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"terms"`
}

// S741 (A269, TR1, TR4, TR5): a version saved one day late is moved to the date it was meant
// for; the occurrence between the two dates takes its amount.
func TestReviseLatestTerms(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.addTerms(id, "2026-12-08", 230000)

	if o := f.occurrence(id, 2); o.ExpectedOn != "2026-12-07" || o.ExpectedAmount.Amount != 210000 {
		t.Fatalf("sequence 2 before the revision = %+v", o)
	}

	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPut,
			"/api/v1/schedules/"+id+"/terms/2026-11-01",
			map[string]any{"effective_from": "2026-11-01", "amount": apitest.BRL(1)},
		),
		http.StatusConflict,
		"terms_not_latest",
		"",
	)
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPut,
			"/api/v1/schedules/"+id+"/terms/2026-12-08",
			map[string]any{"effective_from": "2026-11-01"},
		),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"effective_from",
	)

	var sch termsView
	f.h.MustDo(
		http.MethodPut,
		"/api/v1/schedules/"+id+"/terms/2026-12-08",
		map[string]any{"effective_from": "2026-12-01"},
		http.StatusOK,
		&sch,
	)

	if len(sch.Terms) != 2 || sch.Terms[1].EffectiveFrom != "2026-12-01" ||
		sch.Terms[1].Amount.Amount != 230000 {
		t.Errorf("terms = %+v", sch.Terms)
	}

	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	if o := got[1]; o.ExpectedOn != "2026-11-05" || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 1 = %+v", o)
	}

	if o := got[2]; o.ExpectedOn != "2026-12-07" || o.ExpectedAmount.Amount != 230000 {
		t.Errorf("sequence 2 = %+v", o)
	}

	if o := got[3]; o.ExpectedOn != "2027-01-05" || o.ExpectedAmount.Amount != 230000 {
		t.Errorf("sequence 3 = %+v", o)
	}

	if len(got) != 12 {
		t.Errorf("occurrences = %d, want 12", len(got))
	}
}

// S742 (A269, TR2): the first version changes its amount only; a realized occurrence keeps the
// amount it was expected with.
func TestReviseFirstTerms(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-05", 210000, f.rent, f.landlord)
	path := "/api/v1/schedules/" + id + "/terms/2026-11-01"
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPut,
			path,
			map[string]any{"effective_from": "2026-11-02", "amount": apitest.BRL(220000)},
		),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"effective_from",
	)
	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, path, map[string]any{
			"effective_from": "2026-11-01",
			"recurrence":     monthly("2026-11-01", 10, ""),
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"recurrence",
	)

	var sch termsView
	f.h.MustDo(
		http.MethodPut,
		path,
		map[string]any{"effective_from": "2026-11-01", "amount": apitest.BRL(220000)},
		http.StatusOK,
		&sch,
	)

	if len(sch.Terms) != 1 || sch.Terms[0].EffectiveFrom != "2026-11-01" ||
		sch.Terms[0].Amount.Amount != 220000 {
		t.Errorf("terms = %+v", sch.Terms)
	}

	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	if o := got[1]; o.State != "realized" || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 1 = %+v", o)
	}

	if o := got[2]; o.ExpectedOn != "2026-12-07" || o.ExpectedAmount.Amount != 220000 {
		t.Errorf("sequence 2 = %+v", o)
	}

	if len(got) != 12 {
		t.Errorf("occurrences = %d, want 12", len(got))
	}
}

// S743 (A269, TR3, TR4): removing the latest version applies the previous one again; the first
// version and a version that is not the latest are never removed.
func TestRemoveLatestTerms(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.addTerms(id, "2026-12-08", 230000)
	f.h.ExpectProblem(
		f.h.Do(http.MethodDelete, "/api/v1/schedules/"+id+"/terms/2026-11-01", nil),
		http.StatusConflict,
		"terms_not_latest",
		"",
	)

	var sch termsView
	f.h.MustDo(
		http.MethodDelete,
		"/api/v1/schedules/"+id+"/terms/2026-12-08",
		nil,
		http.StatusOK,
		&sch,
	)

	if len(sch.Terms) != 1 || sch.Terms[0].EffectiveFrom != "2026-11-01" {
		t.Errorf("terms = %+v", sch.Terms)
	}

	got := f.bySequence(id, "2026-11-01", "2027-10-31")
	if o := got[3]; o.ExpectedOn != "2027-01-05" || o.ExpectedAmount.Amount != 210000 {
		t.Errorf("sequence 3 = %+v", o)
	}

	if len(got) != 12 {
		t.Errorf("occurrences = %d, want 12", len(got))
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodDelete, "/api/v1/schedules/"+id+"/terms/2026-11-01", nil),
		http.StatusConflict,
		"terms_first",
		"",
	)
}

func (f fixture) addTerms(scheduleID, from string, amount int64) {
	f.h.T().Helper()

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/schedules/"+scheduleID+"/terms",
		map[string]any{"effective_from": from, "amount": apitest.BRL(amount)},
		http.StatusCreated,
		nil,
	)
}

// A269: manage_schedule revises and removes the latest terms version, as the schedule screen.
func TestManageScheduleReviseAndRemoveTerms(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.addTerms(id, "2026-12-08", 230000)
	revise := map[string]any{
		"action":      "revise_terms",
		"schedule_id": id,
		"from":        "2026-12-01",
		"amount":      "2400.00",
	}

	p, r := preview(t, f.h, "manage_schedule", revise)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	if p.Action != "manage_schedule.revise_terms" || p.Basis != "2026-12-08|230000" {
		t.Errorf("preview = %+v", p)
	}

	var got toolSchedule
	toolOutput(t, f.h, "manage_schedule", revise, &got)

	if len(got.Terms) != 2 || got.Terms[1].EffectiveFrom != "2026-12-01" ||
		got.Terms[1].Amount.Amount != "2400.00" {
		t.Errorf("terms after revise_terms = %+v", got.Terms)
	}

	remove := map[string]any{"action": "remove_terms", "schedule_id": id}
	toolOutput(t, f.h, "manage_schedule", remove, &got)

	if len(got.Terms) != 1 || got.Terms[0].Amount.Amount != "2100.00" {
		t.Errorf("terms after remove_terms = %+v", got.Terms)
	}

	f.h.ExpectToolError(f.h.Tool("manage_schedule", remove), "terms_first", "")
	f.h.ExpectToolError(
		f.h.Tool("manage_schedule", map[string]any{"action": "revise_terms", "schedule_id": id}),
		"invalid_arguments",
		"from",
	)
}
