package domain

import (
	"errors"
	"time"
)

var ErrAlreadyReconciled = errors.New("account is already reconciled after this date")

type Resolution string

const (
	ResolutionNone              Resolution = "none"
	ResolutionYield             Resolution = "yield"
	ResolutionAdjustment        Resolution = "adjustment"
	ResolutionTransactionsAdded Resolution = "transactions_added"
)

// AssertionOutcome: an empty Resolution means the difference stays open for the owner (F6).
type AssertionOutcome struct {
	Difference int64
	Resolution Resolution
	Yield      int64
}

// DecideAssertion compares the institution's balance with the settled balance (5.2.6).
// Only a positive difference on an account with automatic yield becomes yield.
func DecideAssertion(asserted, settled int64, mode YieldMode) AssertionOutcome {
	diff := asserted - settled
	switch {
	case diff == 0:
		return AssertionOutcome{Resolution: ResolutionNone}
	case diff > 0 && mode == YieldAuto:
		return AssertionOutcome{Difference: diff, Resolution: ResolutionYield, Yield: diff}
	default:
		return AssertionOutcome{Difference: diff}
	}
}

// CheckAssertionDate keeps reconciliation in date order: history before the last
// reconciliation changes only after an unlock (P3 amendment A8).
func CheckAssertionDate(date time.Time, lastReconciled *time.Time) error {
	if lastReconciled != nil && date.Before(*lastReconciled) {
		return ErrAlreadyReconciled
	}
	return nil
}
