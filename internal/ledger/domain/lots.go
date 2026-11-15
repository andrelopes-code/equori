package domain

import (
	"errors"
	"math/big"
	"time"
)

// Cost methods: how a sale removes cost from a holding (see CostMethod in package ledger).
const (
	CostAverage = "average"
	CostFIFO    = "fifo"
)

// ErrLotsInconsistent reports open lots that cannot give up the units or the cost asked of them.
var ErrLotsInconsistent = errors.New("open lots are inconsistent with the holding")

// Lot is the part of a holding bought on one date: units and cost in minor units.
type Lot struct {
	AcquiredOn time.Time
	Quantity   int64
	Cost       int64
}

// ConsumeLots removes quantity units from lots, oldest first (lots are ordered by date), and
// returns the lots given up and the lots left. A lot the sale closes gives its whole cost, a
// lot it cuts gives cost × q ÷ units half to even. The given-up lots sum to posted, the cost the
// sale recorded: the difference to the cost of the lots lands on the oldest given-up lot, and
// the opposite difference on the oldest lot left, so the lots left still sum to the cost basis
// when a sale was posted at the average cost.
func ConsumeLots(lots []Lot, quantity, posted int64) (consumed, rest []Lot, err error) {
	if quantity <= 0 {
		return nil, nil, ErrLotsInconsistent
	}

	remaining := quantity

	for i, lot := range lots {
		if remaining == 0 {
			rest = append(rest, lots[i:]...)
			break
		}

		taken := min(remaining, lot.Quantity)
		cost := lot.Cost

		if taken < lot.Quantity {
			cost = lotShare(lot.Cost, taken, lot.Quantity)
			rest = append(rest, Lot{lot.AcquiredOn, lot.Quantity - taken, lot.Cost - cost})
		}

		consumed = append(consumed, Lot{lot.AcquiredOn, taken, cost})
		remaining -= taken
	}

	if remaining > 0 {
		return nil, nil, ErrLotsInconsistent
	}

	return settleCost(consumed, rest, posted)
}

// settleCost moves the difference between posted and the cost of consumed onto the oldest lot of
// each side, then checks that every lot keeps a positive cost.
func settleCost(consumed, rest []Lot, posted int64) (_, _ []Lot, err error) {
	var cost int64
	for _, l := range consumed {
		cost += l.Cost
	}

	delta := posted - cost
	consumed[0].Cost += delta

	switch {
	case len(rest) > 0:
		rest[0].Cost -= delta
	case delta != 0:
		return nil, nil, ErrLotsInconsistent
	}

	for _, l := range append(append([]Lot{}, consumed...), rest...) {
		if l.Cost <= 0 {
			return nil, nil, ErrLotsInconsistent
		}
	}

	return consumed, rest, nil
}

// lotShare returns cost × num ÷ den rounded half to even; den is positive.
func lotShare(cost, num, den int64) int64 {
	n := new(big.Int).Mul(big.NewInt(cost), big.NewInt(num))
	d := big.NewInt(den)

	q, r := new(big.Int).QuoRem(n, d, new(big.Int))

	switch twice := r.Lsh(r, 1).Cmp(d); {
	case twice > 0, twice == 0 && q.Bit(0) == 1:
		q.Add(q, big.NewInt(1))
	}

	return q.Int64()
}
