package domain

import "github.com/google/uuid"

// YearContributions returns the contributions a year paid into the plans that plan selects: the
// cost they hold at its end, minus the cost they held before it, plus the cost its sales took out
// (coverage row U-05). A move of cost from one plan to another, a portability, adds nothing.
func YearContributions(
	start, end []PositionDay,
	sales []RealizedResult,
	plan func(account uuid.UUID) bool,
) int64 {
	var total int64

	for _, p := range end {
		if plan(p.AccountID) {
			total += p.CostBasis
		}
	}

	for _, p := range start {
		if plan(p.AccountID) {
			total -= p.CostBasis
		}
	}

	for _, s := range sales {
		if plan(s.AccountID) {
			total += s.Cost
		}
	}

	return total
}
