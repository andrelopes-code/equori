package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func month(s string) time.Time { return day(s + "-01") }

func TestAverageMonths(t *testing.T) {
	t.Parallel()
	tests := []struct {
		first string
		want  int
	}{
		{"2026-11-03", 1},
		{"2026-10-31", 2},
		{"2026-08-01", 3},
		{"2026-12-02", 0},
	}
	for _, tt := range tests {
		if got := AverageMonths(month("2026-12"), day(tt.first)); got != tt.want {
			t.Errorf("AverageMonths(2026-12, %s) = %d, want %d", tt.first, got, tt.want)
		}
	}
}

func TestDivide(t *testing.T) {
	t.Parallel()
	tests := []struct {
		total int64
		n     int
		want  int64
	}{
		{10, 3, 3},
		{11, 2, 6},
		{-11, 2, -6},
		{600000 * 3, 3, 600000},
	}
	for _, tt := range tests {
		if got := Divide(tt.total, tt.n); got != tt.want {
			t.Errorf("Divide(%d, %d) = %d, want %d", tt.total, tt.n, got, tt.want)
		}
	}
}

func TestPlanRows(t *testing.T) {
	t.Parallel()
	food, market, restaurant := uuid.MustParse("10000000-0000-4000-8000-000000000001"),
		uuid.MustParse("10000000-0000-4000-8000-000000000002"), uuid.MustParse("10000000-0000-4000-8000-000000000003")
	pets, closed, quiet := uuid.MustParse("10000000-0000-4000-8000-000000000004"),
		uuid.MustParse("10000000-0000-4000-8000-000000000005"), uuid.MustParse("10000000-0000-4000-8000-000000000006")
	in := PlanInput{
		Month: month("2026-11"),
		Categories: []PlanCategory{
			{ID: food, Open: true}, {ID: market, ParentID: food, Open: true}, {ID: restaurant, ParentID: food, Open: true},
			{ID: pets, Open: true}, {ID: closed}, {ID: quiet, Open: true},
		},
		Budgets: []Budget{
			{ID: uuid.MustParse("20000000-0000-4000-8000-000000000001"), CategoryID: food,
				Amounts: []BudgetAmount{{EffectiveFrom: month("2026-10"), Amount: 180000}, {EffectiveFrom: month("2027-01"), Amount: 200000}}},
			{ID: uuid.MustParse("20000000-0000-4000-8000-000000000002"), CategoryID: market,
				Amounts: []BudgetAmount{{EffectiveFrom: month("2026-10"), Amount: 100000}}},
		},
		Own: map[uuid.UUID]map[time.Time]int64{
			market:     {month("2026-09"): 90000, month("2026-10"): 120000},
			restaurant: {month("2026-10"): 30000},
			pets:       {month("2026-08"): 21000, month("2026-10"): 9000},
			closed:     {month("2026-10"): 5000},
			// Spending of the month itself is not history.
			quiet: {month("2026-11"): 7000},
		},
		FirstPosting: day("2026-08-15"),
		HasPostings:  true,
	}
	rows, n := PlanRows(in)
	if n != 3 {
		t.Fatalf("average months = %d, want 3", n)
	}
	want := []PlanRow{
		{CategoryID: food, BudgetID: in.Budgets[0].ID, Planned: 180000, LastMonth: 150000, Average: Divide(240000, 3), Counted: true,
			NextChange: month("2027-01"), HasNextChange: true},
		{CategoryID: market, BudgetID: in.Budgets[1].ID, Planned: 100000, LastMonth: 120000, Average: Divide(210000, 3)},
		{CategoryID: pets, LastMonth: 9000, Average: Divide(30000, 3), Counted: true},
	}
	if len(rows) != len(want) {
		t.Fatalf("rows = %+v, want %+v", rows, want)
	}
	for i := range want {
		if rows[i] != want[i] {
			t.Errorf("row %d = %+v, want %+v", i, rows[i], want[i])
		}
	}
}

func TestPlanRowsWithoutHistory(t *testing.T) {
	t.Parallel()
	food := uuid.MustParse("10000000-0000-4000-8000-000000000001")
	rows, n := PlanRows(PlanInput{Month: month("2026-11"), Categories: []PlanCategory{{ID: food, Open: true}}})
	if n != 0 || len(rows) != 0 {
		t.Fatalf("rows = %+v, months = %d, want none", rows, n)
	}
}
