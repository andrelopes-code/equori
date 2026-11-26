package domain

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Budget end E6: the end replaces the version of its month and removes the later ones.
func TestBudgetEnd(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		amounts  []BudgetAmount
		end      string
		want     []BudgetAmount
		removed  []BudgetAmount
		rejected bool
	}{
		{
			name:    "after the only version",
			amounts: []BudgetAmount{amountFrom("2026-11", 42800)},
			end:     "2026-12",
			want:    []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
		},
		{
			name: "removes a later version",
			amounts: []BudgetAmount{
				amountFrom("2026-11", 180000),
				amountFrom("2027-01", 150000),
			},
			end:     "2026-12",
			want:    []BudgetAmount{amountFrom("2026-11", 180000), endFrom("2026-12")},
			removed: []BudgetAmount{amountFrom("2027-01", 150000)},
		},
		{
			name: "replaces the version of its month",
			amounts: []BudgetAmount{
				amountFrom("2026-11", 180000),
				amountFrom("2026-12", 150000),
			},
			end:     "2026-12",
			want:    []BudgetAmount{amountFrom("2026-11", 180000), endFrom("2026-12")},
			removed: []BudgetAmount{amountFrom("2026-12", 150000)},
		},
		{
			name:    "already ended",
			amounts: []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
			end:     "2027-01",
			want:    []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
		},
		{
			name:    "already ended at its month",
			amounts: []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
			end:     "2026-12",
			want:    []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
		},
		{
			name: "ended with a later resume",
			amounts: []BudgetAmount{
				amountFrom("2026-11", 42800),
				endFrom("2026-12"),
				amountFrom("2027-03", 30000),
			},
			end:     "2027-01",
			want:    []BudgetAmount{amountFrom("2026-11", 42800), endFrom("2026-12")},
			removed: []BudgetAmount{amountFrom("2027-03", 30000)},
		},
		{
			name:     "at the first version",
			amounts:  []BudgetAmount{amountFrom("2026-11", 42800)},
			end:      "2026-11",
			rejected: true,
		},
		{
			name:     "before the first version",
			amounts:  []BudgetAmount{amountFrom("2026-11", 42800)},
			end:      "2026-10",
			rejected: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			b := Budget{Amounts: tt.amounts}

			got, removed, err := b.End(month(tt.end))

			if tt.rejected {
				fe, ok := errors.AsType[*FieldError](err)
				if !ok || fe.Field != "month" || !errors.Is(err, ErrValidation) {
					t.Fatalf("End(%s) error = %v, want a validation error on month", tt.end, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("End(%s): %v", tt.end, err)
			}

			if !slices.Equal(got.Amounts, tt.want) {
				t.Errorf("End(%s) amounts = %v, want %v", tt.end, got.Amounts, tt.want)
			}

			if !slices.Equal(removed, tt.removed) {
				t.Errorf("End(%s) removed = %v, want %v", tt.end, removed, tt.removed)
			}

			if !slices.Equal(b.Amounts, tt.amounts) {
				t.Errorf("End changed its receiver: %v", b.Amounts)
			}
		})
	}
}

// Budget end E4: a budget is in force from its first version to its end, and again from a
// version after the end.
func TestBudgetInForce(t *testing.T) {
	t.Parallel()

	b := Budget{Amounts: []BudgetAmount{
		amountFrom("2026-11", 42800),
		endFrom("2026-12"),
		amountFrom("2027-02", 30000),
	}}
	tests := []struct {
		month string
		want  bool
	}{
		{"2026-10", false},
		{"2026-11", true},
		{"2026-12", false},
		{"2027-01", false},
		{"2027-02", true},
		{"2027-03", true},
	}
	for _, tt := range tests {
		if got := b.InForce(month(tt.month)); got != tt.want {
			t.Errorf("InForce(%s) = %t, want %t", tt.month, got, tt.want)
		}
	}
}

// Budget end E5: the month after an end carries nothing, and a month after the end has no
// progress.
func TestBudgetProgressAcrossEnd(t *testing.T) {
	t.Parallel()

	b := Budget{Rollover: true, Amounts: []BudgetAmount{
		amountFrom("2026-11", 50000),
		endFrom("2026-12"),
		amountFrom("2027-01", 50000),
	}}
	spent := func(m time.Time) (int64, error) {
		if m.Equal(month("2026-11")) {
			return 20000, nil
		}

		return 0, nil
	}

	p, ok, err := b.Progress(month("2027-01"), spent)
	if err != nil || !ok {
		t.Fatalf("Progress(2027-01) = ok %t, err %v", ok, err)
	}

	if p.Planned != 50000 || p.Carried != 0 || p.Spent != 0 || p.Available != 50000 {
		t.Errorf("Progress(2027-01) = %+v, want planned 50000 carried 0 available 50000", p)
	}

	if _, ok, _ := b.Progress(month("2026-12"), spent); ok {
		t.Error("Progress(2026-12) ok = true, want false after the end")
	}
}

// Budget end E4: an ended parent no longer keeps its subcategories out of the count.
func TestCountedBudgetUnderEndedParent(t *testing.T) {
	t.Parallel()

	parent := Budget{CategoryID: uuid.New(), Amounts: []BudgetAmount{
		amountFrom("2026-11", 100000),
		endFrom("2026-12"),
	}}
	child := Budget{CategoryID: uuid.New(), Amounts: []BudgetAmount{amountFrom("2026-11", 20000)}}
	byCategory := map[uuid.UUID]Budget{parent.CategoryID: parent, child.CategoryID: child}
	parents := map[uuid.UUID]uuid.UUID{child.CategoryID: parent.CategoryID}

	if CountedBudget(child, month("2026-11"), byCategory, parents) {
		t.Error("CountedBudget(child, 2026-11) = true, want false under a parent in force")
	}

	if !CountedBudget(child, month("2026-12"), byCategory, parents) {
		t.Error("CountedBudget(child, 2026-12) = false, want true after the parent's end")
	}
}

func amountFrom(m string, amount int64) BudgetAmount {
	return BudgetAmount{EffectiveFrom: month(m), Amount: amount}
}

func endFrom(m string) BudgetAmount {
	return BudgetAmount{EffectiveFrom: month(m), Ended: true}
}
