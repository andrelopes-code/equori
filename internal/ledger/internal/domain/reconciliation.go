package domain

import (
	"errors"
	"math/big"
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

// YieldBound is the largest yield, in minor units, that settled can accrue over days
// calendar days: percent per 30 days, rounded down, at least one day.
func YieldBound(settled int64, days int, percent int64) int64 {
	if settled <= 0 {
		return 0
	}
	n := new(big.Int).Mul(big.NewInt(settled), big.NewInt(percent))
	n.Mul(n, big.NewInt(int64(max(days, 1))))
	return n.Div(n, big.NewInt(100*30)).Int64()
}

// DecideSyncedReserve compares a reserved balance reported by an aggregator with the settled
// balance. days is the span since the previous assertion; 0 means there is none. percent is the
// bound per 30 days of the account's currency. Only a difference within YieldBound on an account
// with automatic yield becomes yield (A75).
func DecideSyncedReserve(asserted, settled int64, days int, mode YieldMode, percent int64) AssertionOutcome {
	diff := asserted - settled
	switch {
	case diff == 0:
		return AssertionOutcome{Resolution: ResolutionNone}
	case mode == YieldAuto && days > 0 && diff > 0 && diff <= YieldBound(settled, days, percent):
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
