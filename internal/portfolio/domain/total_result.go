package domain

import (
	"cmp"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Amount is a sum of minor units in one currency.
type Amount struct {
	Units    int64
	Currency money.Currency
}

// AccountResult is what a security account returned beside its price (amendment A262 TR1): the
// results of its sales and its income net of withholding. A part is nil when no row holds it.
type AccountResult struct {
	Realized, Income *Amount
}

// AccountResults sums the results and the net income of each account. The rows of one account come
// from one brokerage, so they share its currency.
func AccountResults(
	results []RealizedResult,
	incomes []IncomeEvent,
) map[uuid.UUID]AccountResult {
	out := map[uuid.UUID]AccountResult{}

	for _, r := range results {
		a := out[r.AccountID]
		a.Realized = added(a.Realized, r.Result, r.Currency)
		out[r.AccountID] = a
	}

	for _, in := range incomes {
		a := out[in.AccountID]
		a.Income = added(a.Income, in.Gross-in.Withheld, in.Currency)
		out[in.AccountID] = a
	}

	return out
}

// ResultTotals sums the parts of every account per currency, ordered by currency code (TR2).
func ResultTotals(accounts map[uuid.UUID]AccountResult) (realized, income []Amount) {
	r, i := map[money.Currency]int64{}, map[money.Currency]int64{}

	for _, a := range accounts {
		if a.Realized != nil {
			r[a.Realized.Currency] += a.Realized.Units
		}

		if a.Income != nil {
			i[a.Income.Currency] += a.Income.Units
		}
	}

	return sortedAmounts(r), sortedAmounts(i)
}

func added(a *Amount, units int64, currency money.Currency) *Amount {
	if a == nil {
		return &Amount{Units: units, Currency: currency}
	}

	a.Units += units

	return a
}

func sortedAmounts(sums map[money.Currency]int64) []Amount {
	out := make([]Amount, 0, len(sums))
	for c, units := range sums {
		out = append(out, Amount{Units: units, Currency: c})
	}

	slices.SortFunc(out, func(a, b Amount) int { return cmp.Compare(a.Currency, b.Currency) })

	return out
}
