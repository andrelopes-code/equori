package planning_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
)

// Spec 2026-11-03 §13: a series already covered by a schedule names it.
func TestRecurringCovered(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-08-20", 210000, f.rent, f.landlord)
	f.pay("2026-09-20", 210000, f.rent, f.landlord)
	f.pay("2026-10-20", 210000, f.rent, f.landlord)

	got := f.recurring(app.RecurringFilter{})
	if len(got) != 1 {
		t.Fatalf("series = %d, want 1", len(got))
	}

	if got[0].ScheduleID != uuid.Nil {
		t.Errorf("ScheduleID before any schedule = %v, want nil", got[0].ScheduleID)
	}

	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-20", 20, ""),
		map[string]any{"payee_id": f.landlord})

	got = f.recurring(app.RecurringFilter{})
	if len(got) != 1 {
		t.Fatalf("series = %d, want 1", len(got))
	}

	if got[0].ScheduleID.String() != id {
		t.Errorf("ScheduleID = %v, want %v", got[0].ScheduleID, id)
	}

	if got[0].Frequency != app.CadenceMonthly || got[0].Count != 3 || got[0].LastAmount != 210000 {
		t.Errorf("series = %+v", got[0])
	}

	if got[0].NextDate.Format(time.DateOnly) != "2026-11-20" {
		t.Errorf("NextDate = %v, want 2026-11-20", got[0].NextDate)
	}

	if got[0].PayeeID.String() != f.landlord || got[0].CategoryID.String() != f.rent || got[0].AccountID.String() != f.checking {
		t.Errorf("series ids = %+v", got[0])
	}
}

// A schedule that ended before today does not cover a series.
func TestRecurringEndedScheduleDoesNotCover(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-08-20", 210000, f.rent, f.landlord)
	f.pay("2026-09-20", 210000, f.rent, f.landlord)
	f.pay("2026-10-20", 210000, f.rent, f.landlord)

	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-08-20", 20, ""),
		map[string]any{"payee_id": f.landlord})
	if _, err := f.h.Pool.Exec(t.Context(), `UPDATE planning_schedule SET ends_on = '2026-10-19' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}

	got := f.recurring(app.RecurringFilter{})
	if len(got) != 1 || got[0].ScheduleID != uuid.Nil {
		t.Errorf("series = %+v, want one without a schedule", got)
	}
}

func TestRecurringFilters(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-08-20", 210000, f.rent, f.landlord)
	f.pay("2026-09-20", 210000, f.rent, f.landlord)
	f.pay("2026-10-20", 210000, f.rent, f.landlord)

	tests := []struct {
		name   string
		filter app.RecurringFilter
		want   int
	}{
		{"payee", app.RecurringFilter{PayeeID: uuid.MustParse(f.landlord)}, 1},
		{"other payee", app.RecurringFilter{PayeeID: uuid.New()}, 0},
		{"account", app.RecurringFilter{AccountID: uuid.MustParse(f.checking)}, 1},
		{"other account", app.RecurringFilter{AccountID: uuid.MustParse(f.savings)}, 0},
		{"text on the key", app.RecurringFilter{Text: f.landlord[:8]}, 1},
		{"text elsewhere", app.RecurringFilter{Text: "netflix"}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := f.recurring(tt.filter); len(got) != tt.want {
				t.Errorf("series = %d, want %d", len(got), tt.want)
			}
		})
	}
}

// The probe is a transaction not recorded yet: with one recorded monthly payment it makes a series of two.
func TestRecurringProbe(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-09-20", 210000, f.rent, f.landlord)

	if got := f.recurring(app.RecurringFilter{}); len(got) != 0 {
		t.Fatalf("series without probe = %d, want 0", len(got))
	}

	probe := app.SeriesFact{
		AccountID: uuid.MustParse(f.checking), CategoryID: uuid.MustParse(f.rent), PayeeID: uuid.MustParse(f.landlord),
		Key: f.landlord, Date: time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), Amount: 210000,
	}

	got := f.recurring(app.RecurringFilter{Probe: &probe})
	if len(got) != 1 {
		t.Fatalf("series with probe = %d, want 1", len(got))
	}

	if got[0].Count != 2 || got[0].Frequency != app.CadenceMonthly || got[0].LastAmount != 210000 {
		t.Errorf("series = %+v", got[0])
	}

	for _, id := range got[0].TransactionIDs {
		if id == uuid.Nil {
			t.Errorf("TransactionIDs holds the probe: %v", got[0].TransactionIDs)
		}
	}

	other := probe
	other.Key, other.PayeeID = "other", uuid.Nil

	if got := f.recurring(app.RecurringFilter{Probe: &other}); len(got) != 0 {
		t.Errorf("series of an unrelated probe = %d, want 0", len(got))
	}
}

func (f fixture) recurring(filter app.RecurringFilter) []app.Series {
	f.h.T().Helper()

	got, err := f.h.App.Planning.RecurringForTest(f.h.T().Context(), f.h.OwnerID(), filter)
	if err != nil {
		f.h.T().Fatal(err)
	}

	return got
}
