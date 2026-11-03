package planning_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type toolSeries struct {
	Key            string    `json:"key"`
	PayeeID        string    `json:"payee_id"`
	Payee          string    `json:"payee"`
	AccountID      string    `json:"account_id"`
	Account        string    `json:"account"`
	CategoryID     string    `json:"category_id"`
	Category       string    `json:"category"`
	Frequency      string    `json:"frequency"`
	Count          int       `json:"count"`
	LastDate       string    `json:"last_date"`
	LastAmount     toolMoney `json:"last_amount"`
	NextDate       string    `json:"next_date"`
	TransactionIDs []string  `json:"transaction_ids"`
	ScheduleID     string    `json:"schedule_id"`
}

func findRecurring(t *testing.T, f fixture, args map[string]any) []toolSeries {
	t.Helper()

	var out struct {
		Series []toolSeries `json:"series"`
	}

	toolOutput(t, f.h, "find_recurring", args, &out)

	return out.Series
}

func TestFindRecurringMonthlySeries(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-08-20", 210000, f.rent, f.landlord)
	f.pay("2026-09-20", 210000, f.rent, f.landlord)
	f.pay("2026-10-20", 210000, f.rent, f.landlord)

	got := findRecurring(t, f, map[string]any{})
	if len(got) != 1 {
		t.Fatalf("series = %d, want 1", len(got))
	}

	s := got[0]
	if s.Payee != "Landlord" || s.PayeeID != f.landlord || s.Account != "Nubank checking" ||
		s.AccountID != f.checking || s.Category != "Rent" || s.CategoryID != f.rent {
		t.Errorf("names = %+v", s)
	}

	if s.Frequency != "monthly" || s.Count != 3 || s.LastDate != "2026-10-20" || s.NextDate != "2026-11-20" {
		t.Errorf("series = %+v", s)
	}

	if want := (toolMoney{Amount: "2100.00", Currency: "BRL"}); s.LastAmount != want {
		t.Errorf("last_amount = %+v, want %+v", s.LastAmount, want)
	}

	if len(s.TransactionIDs) != 3 || s.ScheduleID != "" {
		t.Errorf("transaction_ids = %v, schedule_id = %q", s.TransactionIDs, s.ScheduleID)
	}
}

func TestFindRecurringFilters(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")
	f.pay("2026-08-20", 210000, f.rent, f.landlord)
	f.pay("2026-09-20", 210000, f.rent, f.landlord)
	f.pay("2026-10-20", 210000, f.rent, f.landlord)

	tests := []struct {
		name string
		args map[string]any
		want int
	}{
		{"payee name", map[string]any{"text": "LANDLO"}, 1},
		{"payee key", map[string]any{"text": f.landlord[:8]}, 1},
		{"other text", map[string]any{"text": "netflix"}, 0},
		{"payee id", map[string]any{"payee_id": f.landlord}, 1},
		{"other account", map[string]any{"account_id": f.savings}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := findRecurring(t, f, tt.args); len(got) != tt.want {
				t.Errorf("series = %d, want %d", len(got), tt.want)
			}
		})
	}
}

func TestFindRecurringAtMostTwenty(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-10-20")

	for i := range 21 {
		for _, date := range []string{"2026-08-20", "2026-09-20", "2026-10-20"} {
			f.h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
				"date": date, "description": fmt.Sprintf("service %02d", i),
				"postings": []any{apitest.Posting(f.checking, -1000), apitest.Posting(f.rent, 1000)},
			}, http.StatusCreated, nil)
		}
	}

	f.h.Dispatch()

	got := findRecurring(t, f, map[string]any{})
	if len(got) != 20 {
		t.Errorf("series = %d, want 20", len(got))
	}
}
