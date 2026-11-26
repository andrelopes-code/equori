package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BudgetAmount is the planned amount of each month from EffectiveFrom, the first day of a month.
// Ended marks the version that ends the budget from EffectiveFrom on; its Amount is 0 (budget
// end E3).
type BudgetAmount struct {
	EffectiveFrom time.Time
	Amount        int64
	Ended         bool
}

// Budget is the monthly plan of one category (P7 amendment A54).
type Budget struct {
	ID, CategoryID uuid.UUID
	Rollover       bool
	Currency       money.Currency
	Amounts        []BudgetAmount // by EffectiveFrom
}

// MonthOf returns the first day of the month of d.
func MonthOf(
	d time.Time,
) time.Time {
	return time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// InForce reports whether a version starts at or before month and the latest such version is
// not an end (budget end E4).
func (b Budget) InForce(month time.Time) bool {
	_, ok := b.planned(month)

	return ok
}

// planned returns the amount in force in month; ok is false before the first amount and after
// an end.
func (b Budget) planned(month time.Time) (int64, bool) {
	var amount int64

	ok := false
	for _, a := range b.Amounts {
		if a.EffectiveFrom.After(month) {
			break
		}

		amount, ok = a.Amount, !a.Ended
	}

	return amount, ok
}

// CountedBudget reports whether b counts in the plan of month: it has an amount in force and no
// category above it has a budget in force (budget plan A129). budgets is keyed by category and
// parents maps each category to its parent.
func CountedBudget(
	b Budget,
	month time.Time,
	budgets map[uuid.UUID]Budget,
	parents map[uuid.UUID]uuid.UUID,
) bool {
	if _, ok := b.planned(month); !ok {
		return false
	}

	for p := parents[b.CategoryID]; p != uuid.Nil; p = parents[p] {
		if above, ok := budgets[p]; ok {
			if _, inForce := above.planned(month); inForce {
				return false
			}
		}
	}

	return true
}

// Progress is a budget in a month. Spent leaves out the expenses a goal pays; GoalPaid is the
// amount of the month left out (planning coherence A257).
type Progress struct {
	Month                              time.Time
	Planned, Carried, Spent, Available int64
	GoalPaid                           int64
}

// Progress walks the months from the first amount to month: available = planned + carried −
// spent, and carried is the previous month's available when Rollover is set. A month after an
// end carries nothing to the next (budget end E5). spent returns the spending of a month; ok is
// false when the budget is not in force in month.
func (b Budget) Progress(
	month time.Time,
	spent func(month time.Time) (int64, error),
) (Progress, bool, error) {
	month = MonthOf(month)
	if _, ok := b.planned(month); !ok {
		return Progress{}, false, nil
	}

	var p Progress

	var carried int64
	for m := b.Amounts[0].EffectiveFrom; !m.After(month); m = m.AddDate(0, 1, 0) {
		planned, inForce := b.planned(m)
		if !inForce {
			carried = 0

			continue
		}

		s, err := spent(m)
		if err != nil {
			return Progress{}, true, err
		}

		p = Progress{
			Month:     m,
			Planned:   planned,
			Carried:   carried,
			Spent:     s,
			Available: planned + carried - s,
		}

		carried = 0
		if b.Rollover {
			carried = p.Available
		}
	}

	return p, true, nil
}

// ReferenceSource names where the reference income of a budget plan comes from (A131).
type ReferenceSource string

const (
	SourceExpectedIncome ReferenceSource = "expected_income"
	SourceAverageIncome  ReferenceSource = "average_income"
	SourceFixed          ReferenceSource = "fixed"
)

// Reference is a book's choice of reference income; Fixed holds the amount of SourceFixed and
// TargetBP the savings target in basis points of the reference (A187).
type Reference struct {
	Source    ReferenceSource
	Fixed     int64
	HasFixed  bool
	TargetBP  int
	HasTarget bool
}
