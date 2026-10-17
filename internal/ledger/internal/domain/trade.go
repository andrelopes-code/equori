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
)

// TradeOrder is a purchase or sale of a security for cash of the same brokerage (M17).
type TradeOrder struct {
	AccountID, CashAccountID, TaxesCategoryID uuid.UUID
	Side                                      Side
	Date                                      time.Time
	Quantity                                  money.Money
	UnitPrice                                 money.Rate
	Fees, Taxes                               *money.Money
	Description                               string
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
}

// Holding is the security account on the trade date: quantity is the sum of its
// amounts, cost basis the sum of its weights.
type Holding struct {
	Quantity, CostBasis money.Money
}

// TradeAccounts are the accounts a trade posts results and taxes to.
type TradeAccounts struct {
	RealizedGains, RealizedLosses, Taxes uuid.UUID
}

// BuildTrade returns the postings of a trade in currency cash: cash, taxes, security,
// result. A sale removes cost at average cost, half to even, and the whole cost basis
// when it sells the whole quantity (P8 amendment A68).
func BuildTrade(o TradeOrder, cash money.Currency, h Holding, accts TradeAccounts) ([]Posting, Trade, error) {
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
	switch {
	case o.Side != SideBuy && o.Side != SideSell:
		return nil, Trade{}, invalid("side", "must be buy or sell")
	case o.Quantity.IsZero() || o.Quantity.IsNegative():
		return nil, Trade{}, invalid("quantity", "must be positive")
	case fees.Currency() != cash || fees.IsNegative():
		return nil, Trade{}, invalid("fees", "must be a non-negative amount in "+string(cash))
	case taxes.Currency() != cash || taxes.IsNegative():
		return nil, Trade{}, invalid("taxes", "must be a non-negative amount in "+string(cash))
	case o.Side == SideBuy && !taxes.IsZero():
		return nil, Trade{}, invalid("taxes", "are withheld on sales only")
	}
	gross, err := money.Convert(o.Quantity, cash, money.Leg{Rate: o.UnitPrice})
	if err != nil || gross.IsZero() {
		return nil, Trade{}, invalid("unit_price", "must give a positive gross amount")
	}
	trade := Trade{AccountID: o.AccountID, CashAccountID: o.CashAccountID, Side: o.Side, Quantity: o.Quantity, UnitPrice: o.UnitPrice, Gross: gross, Fees: fees, Taxes: taxes}

	if o.Side == SideBuy {
		cost, err := gross.Add(fees)
		if err != nil {
			return nil, Trade{}, err
		}
		return []Posting{
			{AccountID: o.CashAccountID, Amount: cost.Neg(), Weight: cost.Neg()},
			{AccountID: o.AccountID, Amount: o.Quantity, Weight: cost},
		}, trade, nil
	}

	if h.Quantity.Amount() < o.Quantity.Amount() {
		return nil, Trade{}, invalid("quantity", "must not exceed the "+h.Quantity.String()+" held on the trade date")
	}
	cost := h.CostBasis
	if o.Quantity.Amount() < h.Quantity.Amount() {
		if cost, err = money.Fraction(h.CostBasis, o.Quantity.Amount(), h.Quantity.Amount()); err != nil {
			return nil, Trade{}, err
		}
	}
	if cost.IsZero() || cost.IsNegative() {
		return nil, Trade{}, invalid("quantity", "the held quantity has no cost basis")
	}
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
	trade.Cost = &cost
	postings := []Posting{{AccountID: o.CashAccountID, Amount: proceeds, Weight: proceeds}}
	if !taxes.IsZero() {
		postings = append(postings, Posting{AccountID: accts.Taxes, Amount: taxes, Weight: taxes})
	}
	postings = append(postings, Posting{AccountID: o.AccountID, Amount: o.Quantity.Neg(), Weight: cost.Neg()})
	switch {
	case result.IsNegative():
		postings = append(postings, Posting{AccountID: accts.RealizedLosses, Amount: result.Neg(), Weight: result.Neg()})
	case !result.IsZero():
		postings = append(postings, Posting{AccountID: accts.RealizedGains, Amount: result.Neg(), Weight: result.Neg()})
	}
	return postings, trade, nil
}
