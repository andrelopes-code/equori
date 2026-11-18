package domain

import (
	"testing"

	"github.com/google/uuid"
)

// Coverage row U-05: the contributions of a year are the cost a plan gained in it, plus the cost
// its redemptions took out; a portability between two plans moves cost and adds nothing.
func TestYearContributions(t *testing.T) {
	t.Parallel()

	a, b, other := uuid.New(), uuid.New(), uuid.New()
	plan := func(id uuid.UUID) bool { return id != other }

	start := []PositionDay{{AccountID: a, CostBasis: 100000}, {AccountID: other, CostBasis: 900}}
	end := []PositionDay{
		{AccountID: a, CostBasis: 30000},
		{AccountID: b, CostBasis: 120000},
		{AccountID: other, CostBasis: 5000},
	}
	sales := []RealizedResult{
		{AccountID: a, Cost: 20000},
		{AccountID: other, Cost: 100},
	}

	// Plan a moved 50,000.00 of cost to plan b, which also received 70,000.00 of contributions;
	// a redeemed units that cost 20,000.00.
	if got := YearContributions(start, end, sales, plan); got != 70000 {
		t.Errorf("YearContributions = %d, want 70000", got)
	}

	if got := YearContributions(nil, nil, nil, plan); got != 0 {
		t.Errorf("YearContributions of nothing = %d, want 0", got)
	}
}
