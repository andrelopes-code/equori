package domain

import "math/big"

// Entry is one receiver of the split as the execution reads it (CN17, CN18).
type Entry struct {
	// Weight is the ideal of the entry in the whole plan on any scale shared by all entries; only
	// ratios and sign matter.
	Weight int64

	Value   int64 // value today, base minor units
	Planned int64 // planned amount from Split
	Unit    int64 // value of one whole unit, base minor units; 0 = cash-like
	Scale   int   // instrument quantity scale; ignored when cash-like
}

// Order is the executable part of an entry: Quantity in steps of 10^-Scale (0 when cash-like) and
// Cost.
type Order struct {
	Quantity int64
	Cost     int64
}

// Execute returns one order per entry, in entry order, and the leftover (CN17, CN18).
func Execute(entries []Entry, amount int64) ([]Order, int64) {
	orders := make([]Order, len(entries))
	leftover := amount

	for i, e := range entries {
		orders[i] = e.floorOrder()
		leftover -= orders[i].Cost
	}

	for leftover > 0 {
		i := lowestEligible(entries, orders, leftover)
		if i < 0 {
			break
		}

		leftover -= orders[i].grow(entries[i], leftover)
	}

	return orders, leftover
}

func (e Entry) cashLike() bool {
	return e.Unit == 0
}

// floorOrder applies CN17: the largest quantity whose cost stays within Planned.
func (e Entry) floorOrder() Order {
	if e.cashLike() {
		return Order{Cost: e.Planned}
	}

	q := new(big.Int).Mul(big.NewInt(e.Planned), e.scaleFactor())
	q.Div(q, big.NewInt(e.Unit))

	return Order{Quantity: q.Int64(), Cost: e.costOf(q.Int64())}
}

// costOf returns ceil(q × Unit / 10^Scale).
func (e Entry) costOf(q int64) int64 {
	scale := e.scaleFactor()
	cost := new(big.Int).Mul(big.NewInt(q), big.NewInt(e.Unit))
	cost.Add(cost, scale)
	cost.Sub(cost, big.NewInt(1))
	cost.Div(cost, scale)

	return cost.Int64()
}

func (e Entry) scaleFactor() *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(e.Scale)), nil)
}

// lowestEligible returns the index of the eligible entry with the lowest (value + cost) / ideal,
// the first in plan order on a tie, or -1 when no entry is eligible.
func lowestEligible(entries []Entry, orders []Order, leftover int64) int {
	best := -1

	for i, e := range entries {
		if !orders[i].eligible(e, leftover) {
			continue
		}

		if best < 0 || lowerRatio(entries[i], orders[i], entries[best], orders[best]) {
			best = i
		}
	}

	return best
}

// lowerRatio reports whether a has a strictly lower (value + cost) / ideal than b. The comparison
// cross-multiplies in big.Int because the products can pass 64 bits.
func lowerRatio(a Entry, oa Order, b Entry, ob Order) bool {
	left := new(big.Int).Add(big.NewInt(a.Value), big.NewInt(oa.Cost))
	left.Mul(left, big.NewInt(b.Weight))

	right := new(big.Int).Add(big.NewInt(b.Value), big.NewInt(ob.Cost))
	right.Mul(right, big.NewInt(a.Weight))

	return left.Cmp(right) < 0
}

// eligible reports CN18 eligibility. A step whose cost rounds to zero is not eligible: it would
// repeat without consuming the leftover.
func (o Order) eligible(e Entry, leftover int64) bool {
	if e.Weight <= 0 {
		return false
	}

	if e.cashLike() {
		return true
	}

	step := o.stepCost(e)

	return step > 0 && step <= leftover
}

func (o Order) stepCost(e Entry) int64 {
	return e.costOf(o.Quantity+1) - o.Cost
}

// grow executes one reassignment step and returns the amount it consumed: the whole leftover for a
// cash-like entry, the step cost otherwise.
func (o *Order) grow(e Entry, leftover int64) int64 {
	if e.cashLike() {
		o.Cost += leftover

		return leftover
	}

	step := o.stepCost(e)
	o.Quantity++
	o.Cost += step

	return step
}
