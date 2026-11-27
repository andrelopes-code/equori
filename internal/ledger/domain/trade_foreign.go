package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

// foreignTrade builds a purchase or sale paid in a currency other than the base: the amounts of
// trade, in the cash currency, convert at the rate of o to the base currency (FC3), every posting
// but the cash one is built from them, and the cash posting keeps the amount in the cash
// currency with the base amount as its weight (FC4). A sale separates no day trade (FC6).
func foreignTrade(
	o TradeOrder,
	h Holding,
	accts TradeAccounts,
	trade Trade,
) ([]Posting, Trade, error) {
	cash, base := trade.Gross.Currency(), h.CostBasis.Currency()

	switch {
	case o.Side != SideBuy && o.Side != SideSell:
		return nil, Trade{}, invalid("exchange_rate", "is taken by a purchase or a sale only")
	case base == "" || base == cash:
		return nil, Trade{}, invalid("exchange_rate", "is taken only with cash in another currency")
	}

	cashAmount, err := cashAmountOf(o.Side, trade)
	if err != nil {
		return nil, Trade{}, err
	}

	converted, err := tradeInBase(trade, *o.ExchangeRate, base)
	if err != nil {
		return nil, Trade{}, err
	}

	var postings []Posting
	if o.Side == SideBuy {
		postings, converted, err = buyTrade(o, converted)
	} else {
		postings, converted, err = sellTrade(o, h, nil, accts, converted)
	}

	if err != nil {
		return nil, Trade{}, err
	}

	postings[0].Amount, converted.ExchangeRate = cashAmount, o.ExchangeRate

	return postings, converted, nil
}

// cashAmountOf is the amount that leaves the cash account of a purchase (negative) or enters
// the one of a sale, in the cash currency.
func cashAmountOf(side Side, trade Trade) (money.Money, error) {
	if side == SideBuy {
		cost, err := trade.Gross.Add(trade.Fees)

		return cost.Neg(), err
	}

	net, err := trade.Gross.Sub(trade.Fees)
	if err != nil {
		return money.Money{}, err
	}

	proceeds, err := net.Sub(trade.Taxes)
	if err != nil {
		return money.Money{}, err
	}

	if proceeds.IsZero() || proceeds.IsNegative() {
		return money.Money{}, invalid("fees", "fees and taxes must be less than the gross amount")
	}

	return proceeds, nil
}

// tradeInBase returns trade with its gross, fees and taxes converted to base, each rounded half to
// even (FC3).
func tradeInBase(trade Trade, rate money.Rate, base money.Currency) (Trade, error) {
	var err error

	for _, m := range []*money.Money{&trade.Gross, &trade.Fees, &trade.Taxes} {
		if *m, err = toBase(*m, rate, base); err != nil {
			return Trade{}, err
		}
	}

	return trade, nil
}

func toBase(m money.Money, rate money.Rate, base money.Currency) (money.Money, error) {
	return money.Convert(m, base, money.Leg{Rate: rate})
}
