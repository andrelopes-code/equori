package planning_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/planning"
)

func TestRecurringFor(t *testing.T) {
	t.Parallel()

	date := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name   string
		probe  planning.RecurringProbe
		wantOK bool
	}{
		{"joins the monthly series", planning.RecurringProbe{Payee: "landlord", Account: "Nubank checking", Date: date, Amount: "2100.00", Currency: "BRL"}, true},
		{"amount outside the band", planning.RecurringProbe{Payee: "Landlord", Account: "Nubank checking", Date: date, Amount: "9000.00", Currency: "BRL"}, false},
		{"other payee", planning.RecurringProbe{Payee: "Gym", Account: "Nubank checking", Date: date, Amount: "2100.00", Currency: "BRL"}, false},
		{"unknown account", planning.RecurringProbe{Payee: "Landlord", Account: "Nowhere", Date: date, Amount: "2100.00", Currency: "BRL"}, false},
		{"unparsable amount", planning.RecurringProbe{Payee: "Landlord", Account: "Nubank checking", Date: date, Amount: "abc", Currency: "BRL"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, "2026-10-20")
			f.pay("2026-09-20", 210000, f.rent, f.landlord)

			series, ok, err := f.h.App.Planning.RecurringFor(t.Context(), f.h.OwnerID(), tt.probe)
			if err != nil {
				t.Fatal(err)
			}

			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}

			if !ok {
				return
			}

			var s toolSeries
			if err := json.Unmarshal(series, &s); err != nil {
				t.Fatal(err)
			}

			if s.Frequency != "monthly" || s.Count != 2 || s.Payee != "Landlord" || s.Account != "Nubank checking" {
				t.Errorf("series = %+v", s)
			}
		})
	}
}
