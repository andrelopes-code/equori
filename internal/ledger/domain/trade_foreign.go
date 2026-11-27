package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

// foreignTrade builds a purchase, a sale or an opening in a currency other than the base: the
// amounts of trade, in the cash currency (the quote currency on an opening), convert at the rate
// of o to the base currency (FC3), every posting but the cash one is built from them, and the
// cash posting keeps the amount in the cash currency with the base amount as its weight (FC4).
// An opening has no cash posting (FC7). A sale separates no day trade (FC6).
func foreignTrade(
	o TradeOrder,
	h Holding,
	accts TradeAccounts,
	trade Trade,
) ([]Posting, Trade, error) {
	cash, base := trade.Gross.Currency(), h.CostBasis.Currency()

	switch {
	case o.Side != SideBuy && o.Side != SideSell && o.Side != SideOpening:
		return nil, Trade{}, invalid(
			"exchange_rate", "is taken by a purchase, a sale or an opening only",
		)
	case base == "" || base == cash:
		return nil, Trade{}, invalid("exchange_rate", "is taken only with cash in another currency")
	}

	converted, err := tradeInBase(trade, *o.ExchangeRate, base)
	if err != nil {
		return nil, Trade{}, err
	}

	if o.Side == SideOpening {
		postings, opened, err := openingTrade(o, converted)
		opened.ExchangeRate = o.ExchangeRate

		return postings, opened, err
	}

	build := buyTrade
	if o.Side == SideSell {
		build = func(o TradeOrder, t Trade) ([]Posting, Trade, error) {
			return sellTrade(o, h, nil, accts, t)
		}
	}

	return foreignCashTrade(o, trade, converted, build)
}

// foreignCashTrade builds the postings of converted with build and gives the cash posting the
// amount of trade, in the cash currency.
func foreignCashTrade(
	o TradeOrder,
	trade, converted Trade,
	build func(TradeOrder, Trade) ([]Posting, Trade, error),
) ([]Posting, Trade, error) {
	cashAmount, err := cashAmountOf(o.Side, trade)
	if err != nil {
		return nil, Trade{}, err
	}

	postings, converted, err := build(o, converted)
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

// BaseTotal converts each amount of plus and minus to base at rate, rounded half to even (FC3),
// and returns the absolute difference of the two sums: the weight of the cash posting (FC4).
func BaseTotal(
	rate money.Rate,
	base money.Currency,
	plus, minus []money.Money,
) (money.Money, error) {
	total, err := money.New(0, base)
	if err != nil {
		return total, err
	}

	for sign, parts := range [][]money.Money{plus, minus} {
		for _, m := range parts {
			c, err := toBase(m, rate, base)
			if err != nil {
				return total, err
			}

			if sign == 1 {
				c = c.Neg()
			}

			if total, err = total.Add(c); err != nil {
				return total, err
			}
		}
	}

	if total.IsNegative() {
		total = total.Neg()
	}

	return total, nil
}
