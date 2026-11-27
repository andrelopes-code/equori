package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

// foreignIncome builds an income paid in a currency other than the base: the gross and the
// withheld, in the cash currency, convert at the rate of o to o.Base (FC3); the cash posting keeps
// the net amount in the cash currency with the base net amount as its weight (FC4).
func foreignIncome(o IncomeOrder, withheld, net money.Money) ([]Posting, Income, error) {
	if o.Base == "" || o.Base == o.Gross.Currency() {
		return nil, Income{}, invalid(
			"exchange_rate",
			"is taken only with cash in another currency",
		)
	}

	gross, err := toBase(o.Gross, *o.ExchangeRate, o.Base)
	if err != nil {
		return nil, Income{}, err
	}

	taxed, err := toBase(withheld, *o.ExchangeRate, o.Base)
	if err != nil {
		return nil, Income{}, err
	}

	weight, err := gross.Sub(taxed)
	if err != nil || weight.IsZero() || weight.IsNegative() {
		return nil, Income{}, invalid("withheld", "must be less than gross in "+string(o.Base))
	}

	postings := []Posting{{AccountID: o.CashAccountID, Amount: net, Weight: weight}}
	if !taxed.IsZero() {
		postings = append(
			postings,
			Posting{AccountID: o.WithheldCategoryID, Amount: taxed, Weight: taxed},
		)
	}

	postings = append(
		postings,
		Posting{AccountID: o.CategoryID, Amount: gross.Neg(), Weight: gross.Neg()},
	)

	return postings, Income{
		AccountID:     o.AccountID,
		CashAccountID: o.CashAccountID,
		Type:          o.Type,
		Gross:         gross,
		Withheld:      taxed,
		ExchangeRate:  o.ExchangeRate,
	}, nil
}
