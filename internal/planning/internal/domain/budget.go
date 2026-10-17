package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BudgetAmount is the planned amount of each month from EffectiveFrom, the first day of a month.
type BudgetAmount struct {
	EffectiveFrom time.Time
	Amount        int64
}

// Budget is the monthly plan of one category (P7 amendment A54).
type Budget struct {
	ID, CategoryID uuid.UUID
	Rollover       bool
	Currency       money.Currency
	Amounts        []BudgetAmount // by EffectiveFrom
}

// MonthOf returns the first day of the month of d.
func MonthOf(d time.Time) time.Time { return time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC) }

// planned returns the amount in force in month; ok is false before the first amount.
func (b Budget) planned(month time.Time) (int64, bool) {
	var amount int64
	ok := false
	for _, a := range b.Amounts {
		if a.EffectiveFrom.After(month) {
			break
		}
		amount, ok = a.Amount, true
	}
	return amount, ok
}

type Progress struct {
	Month                              time.Time
	Planned, Carried, Spent, Available int64
}

// Progress walks the months from the first amount to month: available = planned + carried −
// spent, and carried is the previous month's available when Rollover is set. spent returns the
// spending of a month; ok is false when month precedes the first amount.
func (b Budget) Progress(month time.Time, spent func(month time.Time) (int64, error)) (Progress, bool, error) {
	month = MonthOf(month)
	if _, ok := b.planned(month); !ok {
		return Progress{}, false, nil
	}
	var p Progress
	var carried int64
	for m := b.Amounts[0].EffectiveFrom; !m.After(month); m = m.AddDate(0, 1, 0) {
		planned, _ := b.planned(m)
		s, err := spent(m)
		if err != nil {
			return Progress{}, true, err
		}
		p = Progress{Month: m, Planned: planned, Carried: carried, Spent: s, Available: planned + carried - s}
		carried = 0
		if b.Rollover {
			carried = p.Available
		}
	}
	return p, true, nil
}
