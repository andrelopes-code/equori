package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

// DayTrade is a trade of the sale's holding on its date (A228 IO11).
type DayTrade struct {
	Side                                    Side
	Quantity, Gross, Fees, DayTradeQuantity int64
}

// Day is what a sale reads of its date when the region separates day trades (A228 IO11):
// the buys of the date in recording order and the day-trade quantity of its earlier sales.
type Day struct {
	Buys    []DayBuy
	Matched int64
}

// DayBuy is a purchase of the date: units and cost (gross + fees), in minor units.
type DayBuy struct{ Quantity, Cost int64 }

// NewDay builds the Day of a sale from the trades of its date.
func NewDay(trades []DayTrade) Day {
	var d Day

	for _, tr := range trades {
		if tr.Side == SideBuy || tr.Side == SideOpening {
			d.Buys = append(d.Buys, DayBuy{Quantity: tr.Quantity, Cost: tr.Gross + tr.Fees})
			continue
		}

		d.Matched += tr.DayTradeQuantity
	}

	return d
}

// soldLot is the cost basis a sale removes and the day-trade part of it.
type soldLot struct {
	Cost, DayQuantity, DayCost money.Money
}

// dayLot splits a sale of q units of a holding of h under day (A228 IO12, IO13): the units
// that close the day's purchases take the cost of those purchases, the rest the average cost of
// the stock held before the date.
func dayLot(q money.Money, h Holding, day Day) (soldLot, error) {
	var bought, boughtCost int64
	for _, b := range day.Buys {
		bought += b.Quantity
		boughtCost += b.Cost
	}

	open := max(bought-day.Matched, 0)
	dt := min(q.Amount(), open)
	swing := q.Amount() - dt

	cur := h.CostBasis.Currency()

	before, err := prefixCost(day.Buys, day.Matched, cur)
	if err != nil {
		return soldLot{}, err
	}

	through, err := prefixCost(day.Buys, day.Matched+dt, cur)
	if err != nil {
		return soldLot{}, err
	}

	dayCost, err := through.Sub(before)
	if err != nil {
		return soldLot{}, err
	}

	stockQuantity := h.Quantity.Amount() - open

	stockCost, err := money.New(h.CostBasis.Amount()-(boughtCost-before.Amount()), cur)
	if err != nil {
		return soldLot{}, err
	}

	swingCost, err := stockShare(stockCost, swing, stockQuantity)
	if err != nil {
		return soldLot{}, err
	}

	cost, err := dayCost.Add(swingCost)
	if err != nil {
		return soldLot{}, err
	}

	dayQuantity, err := money.Fraction(q, dt, q.Amount())
	if err != nil {
		return soldLot{}, err
	}

	return soldLot{Cost: cost, DayQuantity: dayQuantity, DayCost: dayCost}, nil
}

// prefixCost is the cost of the first x units bought on the date: the whole buys before x plus
// the share of the buy that holds x, half to even (A228 IO12, F(x)).
func prefixCost(buys []DayBuy, x int64, cur money.Currency) (money.Money, error) {
	var sum, before int64

	for _, b := range buys {
		if x >= before+b.Quantity {
			sum += b.Cost
			before += b.Quantity

			continue
		}

		if x > before {
			part, err := money.New(b.Cost, cur)
			if err != nil {
				return money.Money{}, err
			}

			if part, err = money.Fraction(part, x-before, b.Quantity); err != nil {
				return money.Money{}, err
			}

			sum += part.Amount()
		}

		break
	}

	return money.New(sum, cur)
}

// stockShare is the cost of q units of a stock of quantity units and cost stock: nothing for
// no unit, the whole cost for the whole stock, else the average, half to even.
func stockShare(stock money.Money, q, quantity int64) (money.Money, error) {
	switch q {
	case 0:
		return money.New(0, stock.Currency())
	case quantity:
		return stock, nil
	}

	return money.Fraction(stock, q, quantity)
}
