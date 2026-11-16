package domain

import (
	"errors"
	"math/big"
	"slices"
	"time"

	"github.com/google/uuid"
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

// LotPosting is a posting of a security account as the lots are built from it: Cost is its
// signed weight. Source is the account a custody transfer in came from, uuid.Nil otherwise.
type LotPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Quantity      int64
	Cost          int64
	Source        uuid.UUID
}

// ReplayLots builds the open lots of an account from its postings in order. A purchase adds a lot
// dated on its day. A sale or a transfer out consumes the oldest lots at its posted cost. A
// transfer in adds the lots its source gave up, with their dates; sourceLots returns the open
// lots of the source just before the transfer.
func ReplayLots(
	postings []LotPosting,
	sourceLots func(LotPosting) ([]Lot, error),
) (lots []Lot, err error) {
	for _, p := range postings {
		switch {
		case p.Quantity < 0:
			_, lots, err = ConsumeLots(lots, -p.Quantity, -p.Cost)
		case p.Source != uuid.Nil:
			lots, err = addMoved(lots, p, sourceLots)
		default:
			lots = append(lots, Lot{AcquiredOn: p.Date, Quantity: p.Quantity, Cost: p.Cost})
		}

		if err != nil {
			return nil, err
		}

		sortByDate(lots)
	}

	return lots, nil
}

// ConsumeLots removes quantity units from lots, oldest first (lots are ordered by date), and
// returns the lots given up and the lots left. A lot the sale closes gives its whole cost, a
// lot it cuts gives cost × q ÷ units half to even. The given-up lots sum to posted, the cost the
// sale recorded: the difference to the cost of the lots lands on the oldest given-up lot, and
// the opposite difference on the oldest lot left, so the lots left still sum to the cost basis
// when a sale was posted at the average cost.
func ConsumeLots(lots []Lot, quantity, posted int64) (consumed, rest []Lot, err error) {
	consumed, rest, err = takeOldest(lots, quantity)
	if err != nil {
		return nil, nil, err
	}

	return settleCost(consumed, rest, posted)
}

// FIFOCost returns the cost of the quantity units the oldest lots give up.
func FIFOCost(lots []Lot, quantity int64) (int64, error) {
	consumed, _, err := takeOldest(lots, quantity)

	return lotsCost(consumed), err
}

// takeOldest splits lots into the quantity units given up, oldest first, and the lots left.
func takeOldest(lots []Lot, quantity int64) (consumed, rest []Lot, err error) {
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

	return consumed, rest, nil
}

// settleCost moves the difference between posted and the cost of consumed onto the oldest lot of
// each side, then checks that every lot keeps a positive cost.
func settleCost(consumed, rest []Lot, posted int64) (_, _ []Lot, err error) {
	delta := posted - lotsCost(consumed)
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

func lotsCost(lots []Lot) (cost int64) {
	for _, l := range lots {
		cost += l.Cost
	}

	return cost
}

// addMoved adds to lots the lots a transfer in took from its source.
func addMoved(
	lots []Lot,
	p LotPosting,
	sourceLots func(LotPosting) ([]Lot, error),
) ([]Lot, error) {
	source, err := sourceLots(p)
	if err != nil {
		return nil, err
	}

	moved, _, err := ConsumeLots(source, p.Quantity, p.Cost)

	return append(lots, moved...), err
}

func sortByDate(lots []Lot) {
	slices.SortStableFunc(lots, func(a, b Lot) int { return a.AcquiredOn.Compare(b.AcquiredOn) })
}
