package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

// soldCost is the cost basis of the quantity a sale gives up and its day-trade part; a nil day
// takes the average cost of the whole holding.
func soldCost(o TradeOrder, h Holding, day *Day) (lot soldLot, err error) {
	if h.Quantity.Amount() < o.Quantity.Amount() {
		return soldLot{}, invalid(
			"quantity",
			"must not exceed the "+h.Quantity.String()+" held on the trade date",
		)
	}

	switch {
	case h.Method == CostFIFO:
		lot, err = fifoLot(o.Quantity, h)
	case day != nil:
		lot, err = dayLot(o.Quantity, h, *day)
	default:
		lot, err = averageLot(o.Quantity, h)
	}

	if err != nil {
		return soldLot{}, err
	}

	// A holding of rights received at no cost sells at zero cost (coverage row E-06).
	if lot.Cost.IsNegative() || (lot.Cost.IsZero() && !h.CostBasis.IsZero()) {
		return soldLot{}, invalid("quantity", "the held quantity has no cost basis")
	}

	return lot, nil
}

// averageLot removes the average cost of the holding, and the whole cost basis when the sale
// sells the whole quantity (A68).
func averageLot(q money.Money, h Holding) (soldLot, error) {
	cost, err := stockShare(h.CostBasis, q.Amount(), h.Quantity.Amount())
	if err != nil {
		return soldLot{}, err
	}

	zeroQuantity, err := q.Sub(q)
	if err != nil {
		return soldLot{}, err
	}

	zeroCost, err := cost.Sub(cost)

	return soldLot{Cost: cost, DayQuantity: zeroQuantity, DayCost: zeroCost}, err
}

// fifoLot removes the cost of the oldest lots of the holding; a sale never separates day trades
// of a holding with lots.
func fifoLot(q money.Money, h Holding) (soldLot, error) {
	amount, err := FIFOCost(h.Lots, q.Amount())
	if err != nil {
		return soldLot{}, err
	}

	cost, err := money.New(amount, h.CostBasis.Currency())
	if err != nil {
		return soldLot{}, err
	}

	zeroQuantity, err := q.Sub(q)
	if err != nil {
		return soldLot{}, err
	}

	zeroCost, err := cost.Sub(cost)

	return soldLot{Cost: cost, DayQuantity: zeroQuantity, DayCost: zeroCost}, err
}
