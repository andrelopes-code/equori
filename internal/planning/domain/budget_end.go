package domain

import (
	"slices"
	"time"
)

// End returns the budget ended from month on and the versions the end removes: the version of
// month and every later one (budget end E6). A budget already out of force at month with no
// later version comes back unchanged. The receiver is not changed.
func (b Budget) End(month time.Time) (Budget, []BudgetAmount, error) {
	month = MonthOf(month)
	if len(b.Amounts) == 0 || !month.After(b.Amounts[0].EffectiveFrom) {
		return Budget{}, nil, &FieldError{
			Field:   "month",
			Message: "must be after the first amount of the budget",
			Err:     ErrValidation,
		}
	}

	cut := len(b.Amounts)
	for i, a := range b.Amounts {
		if !a.EffectiveFrom.Before(month) {
			cut = i

			break
		}
	}

	out := b
	out.Amounts = slices.Clip(b.Amounts[:cut])

	// An end at month is written again below, so it is not a removed version.
	removed := slices.DeleteFunc(slices.Clone(b.Amounts[cut:]), func(a BudgetAmount) bool {
		return a.Ended && a.EffectiveFrom.Equal(month)
	})

	// An end already in force before month keeps the budget out; a second end adds nothing.
	if !out.InForce(month) {
		return out, removed, nil
	}

	out.Amounts = append(out.Amounts, BudgetAmount{EffectiveFrom: month, Ended: true})

	return out, removed, nil
}
