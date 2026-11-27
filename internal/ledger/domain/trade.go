package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Side string

const (
	SideBuy  Side = "buy"
	SideSell Side = "sell"
	// SideWriteOff removes units at zero proceeds: an option expired, a right not exercised, a
	// security that became worthless; their cost is a realized loss (listed options design O3).
	SideWriteOff Side = "write_off"
	// SideOpening records units held before the book at their cost against the opening balances,
	// without cash (investment history design OL1).
	SideOpening Side = "opening"
)

// TradeOrder is a purchase or sale of a security for cash of the same brokerage (M17).
type TradeOrder struct {
	AccountID, CashAccountID, TaxesCategoryID uuid.UUID
	// BrokerageID and Instrument name the holding of a purchase when AccountID is empty (BC6).
	BrokerageID uuid.UUID
	Instrument  money.Currency
	Side        Side
	Date        time.Time
	// SettlementDate is the day the cash settles; nil takes the exchange's cycle (A228 IO6, IO7).
	SettlementDate *time.Time
	Quantity       money.Money
	UnitPrice      money.Rate
	Fees, Taxes    *money.Money
	Description    string
}

// Trade is the D1 detail stored with a trade transaction (P8 amendment A68). Cost is
// the cost basis removed by a sale; a purchase has none.
type Trade struct {
	AccountID, CashAccountID uuid.UUID
	Side                     Side
	Quantity                 money.Money
	UnitPrice                money.Rate
	Gross, Fees, Taxes       money.Money
	Cost                     *money.Money
	// DayTradeQuantity and DayTradeCost are the part of a sale that closes the purchases of its
	// date (A228 IO12); zero on a purchase. The cost is in the cash currency.
	DayTradeQuantity, DayTradeCost money.Money
}

// Holding is the security account on the trade date: quantity is the sum of its
// amounts, cost basis the sum of its weights.
type Holding struct {
	Quantity, CostBasis money.Money
	// Method is the cost method of the holding, CostAverage when empty; Lots are its open lots,
	// read only under CostFIFO.
	Method string
	Lots   []Lot
}

// TradeAccounts are the accounts a trade posts results and taxes to.
type TradeAccounts struct {
	RealizedGains, RealizedLosses, Taxes uuid.UUID
}

// BuildTrade returns the postings of a trade in currency cash: cash, taxes, security,
// result. A sale removes cost at average cost, half to even, and the whole cost basis
// when it sells the whole quantity (P8 amendment A68). A non-nil day separates the units that
// close the day's purchases (A228 IO12).
func BuildTrade(
	o TradeOrder,
	cash money.Currency,
	h Holding,
	day *Day,
	accts TradeAccounts,
) ([]Posting, Trade, error) {
	zero, err := money.New(0, cash)
	if err != nil {
		return nil, Trade{}, err
	}

	fees, taxes := zero, zero
	if o.Fees != nil {
		fees = *o.Fees
	}

	if o.Taxes != nil {
		taxes = *o.Taxes
	}

	if err := checkTradeOrder(o, cash, fees, taxes); err != nil {
		return nil, Trade{}, err
	}

	if o.Side == SideWriteOff {
		return writeOffTrade(o, h, accts, zero)
	}

	gross, err := money.Convert(o.Quantity, cash, money.Leg{Rate: o.UnitPrice})
	if err != nil || gross.IsZero() {
		return nil, Trade{}, invalid("unit_price", "must give a positive gross amount")
	}

	trade := Trade{
		AccountID:     o.AccountID,
		CashAccountID: o.CashAccountID,
		Side:          o.Side,
		Quantity:      o.Quantity,
		UnitPrice:     o.UnitPrice,
		Gross:         gross,
		Fees:          fees,
		Taxes:         taxes,
	}

	switch o.Side {
	case SideBuy:
		return buyTrade(o, trade)
	case SideOpening:
		return openingTrade(o, trade)
	}

	return sellTrade(o, h, day, accts, trade)
}

func checkTradeOrder(o TradeOrder, cash money.Currency, fees, taxes money.Money) error {
	switch {
	case o.Side != SideBuy && o.Side != SideSell && o.Side != SideWriteOff &&
		o.Side != SideOpening:
		return invalid("side", "must be buy, sell, write_off or opening")
	case o.Side == SideWriteOff && o.UnitPrice.Mantissa() != 0:
		return invalid("unit_price", "is not taken by a write-off")
	case o.Side == SideWriteOff && (!fees.IsZero() || !taxes.IsZero()):
		return invalid("fees", "a write-off has no fees and no taxes")
	case o.Quantity.IsZero() || o.Quantity.IsNegative():
		return invalid("quantity", "must be positive")
	case fees.Currency() != cash || fees.IsNegative():
		return invalid("fees", "must be a non-negative amount in "+string(cash))
	case taxes.Currency() != cash || taxes.IsNegative():
		return invalid("taxes", "must be a non-negative amount in "+string(cash))
	case o.Side == SideBuy && !taxes.IsZero():
		return invalid("taxes", "are withheld on sales only")
	case o.Side == SideOpening && !taxes.IsZero():
		return invalid("taxes", "an opening has no taxes")
	}

	return nil
}

func buyTrade(o TradeOrder, trade Trade) ([]Posting, Trade, error) {
	cost, err := trade.Gross.Add(trade.Fees)
	if err != nil {
		return nil, Trade{}, err
	}

	if trade.DayTradeQuantity, err = o.Quantity.Sub(o.Quantity); err != nil {
		return nil, Trade{}, err
	}

	if trade.DayTradeCost, err = trade.Fees.Sub(trade.Fees); err != nil {
		return nil, Trade{}, err
	}

	return []Posting{
		{
			AccountID: o.CashAccountID,
			Amount:    cost.Neg(),
			Weight:    cost.Neg(),
			SettledOn: settledOn(o),
		},
		{AccountID: o.AccountID, Amount: o.Quantity, Weight: cost},
	}, trade, nil
}

// openingTrade posts the cost of the units to the holding against the account o.CashAccountID,
// which the app sets to the opening balances; the trade names the holding as its cash account
// because no cash moves (OL1, OL8).
func openingTrade(o TradeOrder, trade Trade) ([]Posting, Trade, error) {
	cost, err := trade.Gross.Add(trade.Fees)
	if err != nil {
		return nil, Trade{}, err
	}

	if trade.DayTradeQuantity, err = o.Quantity.Sub(o.Quantity); err != nil {
		return nil, Trade{}, err
	}

	if trade.DayTradeCost, err = trade.Fees.Sub(trade.Fees); err != nil {
		return nil, Trade{}, err
	}

	trade.CashAccountID = o.AccountID

	return []Posting{
		{AccountID: o.AccountID, Amount: o.Quantity, Weight: cost},
		{AccountID: o.CashAccountID, Amount: cost.Neg(), Weight: cost.Neg()},
	}, trade, nil
}

func sellTrade(
	o TradeOrder,
	h Holding,
	day *Day,
	accts TradeAccounts,
	trade Trade,
) ([]Posting, Trade, error) {
	gross, fees, taxes := trade.Gross, trade.Fees, trade.Taxes

	lot, err := soldCost(o, h, day)
	if err != nil {
		return nil, Trade{}, err
	}

	cost := lot.Cost

	net, err := gross.Sub(fees)
	if err != nil {
		return nil, Trade{}, err
	}

	proceeds, err := net.Sub(taxes)
	if err != nil {
		return nil, Trade{}, err
	}

	if proceeds.IsZero() || proceeds.IsNegative() {
		return nil, Trade{}, invalid("fees", "fees and taxes must be less than the gross amount")
	}

	result, err := net.Sub(cost)
	if err != nil {
		return nil, Trade{}, err
	}

	trade.Cost, trade.DayTradeQuantity, trade.DayTradeCost = &cost, lot.DayQuantity, lot.DayCost

	postings := sellPostings(o, accts, proceeds, taxes, cost, result)

	return postings, trade, nil
}

// writeOffTrade removes the quantity at its cost, as a sale without a day-trade part would, and
// books that cost as a realized loss; nothing reaches a cash account (W2, W3, W4).
func writeOffTrade(
	o TradeOrder,
	h Holding,
	accts TradeAccounts,
	zero money.Money,
) ([]Posting, Trade, error) {
	lot, err := soldCost(o, h, nil)
	if err != nil {
		return nil, Trade{}, err
	}

	cost := lot.Cost
	postings := []Posting{{AccountID: o.AccountID, Amount: o.Quantity.Neg(), Weight: cost.Neg()}}

	if !cost.IsZero() {
		postings = append(
			postings,
			Posting{AccountID: accts.RealizedLosses, Amount: cost, Weight: cost},
		)
	}

	// No cash moves: the trade names the holding as its cash account (W3).
	return postings, Trade{
		AccountID:        o.AccountID,
		CashAccountID:    o.AccountID,
		Side:             SideWriteOff,
		Quantity:         o.Quantity,
		UnitPrice:        o.UnitPrice,
		Gross:            zero,
		Fees:             zero,
		Taxes:            zero,
		Cost:             &cost,
		DayTradeQuantity: lot.DayQuantity,
		DayTradeCost:     lot.DayCost,
	}, nil
}

func sellPostings(
	o TradeOrder,
	accts TradeAccounts,
	proceeds, taxes, cost, result money.Money,
) []Posting {
	postings := []Posting{{
		AccountID: o.CashAccountID,
		Amount:    proceeds,
		Weight:    proceeds,
		SettledOn: settledOn(o),
	}}
	if !taxes.IsZero() {
		postings = append(postings, Posting{AccountID: accts.Taxes, Amount: taxes, Weight: taxes})
	}

	postings = append(
		postings,
		Posting{AccountID: o.AccountID, Amount: o.Quantity.Neg(), Weight: cost.Neg()},
	)
	switch {
	case result.IsNegative():
		postings = append(
			postings,
			Posting{AccountID: accts.RealizedLosses, Amount: result.Neg(), Weight: result.Neg()},
		)
	case !result.IsZero():
		postings = append(
			postings,
			Posting{AccountID: accts.RealizedGains, Amount: result.Neg(), Weight: result.Neg()},
		)
	}

	return postings
}

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

// settledOn is the settlement date of the cash posting: set only when it is after the date.
func settledOn(o TradeOrder) *time.Time {
	if o.SettlementDate == nil || !o.SettlementDate.After(o.Date) {
		return nil
	}

	return o.SettlementDate
}
