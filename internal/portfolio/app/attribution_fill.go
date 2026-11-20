package app

import (
	"cmp"
	"math/big"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// attributionShare is one instrument of the year with its result (AT2), its capital over the
// days of the portfolio (AT9) and its capital over its own days (AT13).
type attributionShare struct {
	code         money.Currency
	result       int64
	capital, own domain.DayCapital
	row          *attributionRow
}

// fillAttribution sets on out the portfolio (AT3, AT8), each instrument (AT2, AT4, AT9) sorted by
// result (AT7) and the rest; ok is false when no money was at work and no instrument moved.
func fillAttribution(
	out *AttributionYear,
	tree ReturnReport,
	rows map[money.Currency]*attributionRow,
	start time.Time,
) (bool, error) {
	total, flows := treeResult(tree)
	start = domain.MeasuredStart(start, tree.Opening.Amount(), flows)
	capital := domain.Capital(start, out.To, tree.Opening.Amount(), flows)

	if capital.Sum.Sign() <= 0 && len(rows) == 0 {
		return false, nil
	}

	out.Since = start.AddDate(0, 0, 1)
	shares := attributionShares(rows, start, out.To)
	otherResult, otherCapital := total, new(big.Int).Set(capital.Sum)

	for _, sh := range shares {
		otherResult -= sh.result
		otherCapital.Sub(otherCapital, sh.capital.Sum)
	}

	base := tree.Opening.Currency()
	returnBP, ok := domain.RatioBP(total, capital)
	weights, contributions := splitShares(shares, otherResult, otherCapital, capital, returnBP, ok)

	if err := setPortfolio(out, base, total, capital, ifOK(returnBP, ok)); err != nil {
		return false, err
	}

	other := domain.DayCapital{Sum: otherCapital, Days: capital.Days}

	part, err := attributionPart(
		base,
		otherResult,
		other,
		weights[len(shares)],
		contributions[len(shares)],
	)
	if err != nil {
		return false, err
	}

	out.Other = &part

	return true, setItems(out, base, shares, weights, contributions)
}

// treeResult is closing − opening − Σ flows of the tree, and its flows as money put in.
func treeResult(tree ReturnReport) (int64, []domain.CashFlow) {
	total := tree.Closing.Amount() - tree.Opening.Amount()
	flows := make([]domain.CashFlow, len(tree.Flows))

	for i, f := range tree.Flows {
		total -= f.Amount.Amount()
		flows[i] = domain.CashFlow{Date: f.Date, Amount: f.Amount.Amount()}
	}

	return total, flows
}

func attributionShares(
	rows map[money.Currency]*attributionRow,
	start, end time.Time,
) []attributionShare {
	shares := make([]attributionShare, 0, len(rows))

	for code, row := range rows {
		shares = append(shares, attributionShare{
			code: code,
			result: row.endValue - row.endCost - (row.startValue - row.startCost) +
				row.realized + row.income,
			capital: domain.Capital(start, end, row.startValue, row.flows),
			own: domain.Capital(
				domain.MeasuredStart(
					start,
					row.startValue,
					row.flows,
				),
				end,
				row.startValue,
				row.flows,
			),
			row: row,
		})
	}

	slices.SortFunc(shares, func(a, b attributionShare) int {
		return cmp.Or(cmp.Compare(b.result, a.result), cmp.Compare(a.code, b.code))
	})

	return shares
}

// splitShares rounds the weights to 10,000 and the contributions to the return of the portfolio
// by the largest remainder (AT9); the last place of each is the rest. Without a positive capital
// every weight and contribution is zero.
func splitShares(
	shares []attributionShare,
	otherResult int64,
	otherCapital *big.Int,
	capital domain.DayCapital,
	returnBP int,
	ok bool,
) (weights, contributions []int) {
	n := len(shares) + 1
	if !ok {
		return make([]int, n), make([]int, n)
	}

	w := make([]*big.Rat, 0, n)
	c := make([]*big.Rat, 0, n)

	for _, sh := range shares {
		w = append(w, domain.ShareOf(sh.capital.Sum, capital.Sum))
		c = append(c, domain.ContributionOf(sh.result, capital))
	}

	w = append(w, domain.ShareOf(otherCapital, capital.Sum))
	c = append(c, domain.ContributionOf(otherResult, capital))

	return domain.SharesBP(w, 10000), domain.SharesBP(c, returnBP)
}

func setPortfolio(
	out *AttributionYear,
	base money.Currency,
	total int64,
	capital domain.DayCapital,
	returnBP *int,
) error {
	result, err := money.New(total, base)
	if err != nil {
		return err
	}

	average, err := money.New(capital.Average(), base)
	if err != nil {
		return err
	}

	out.Result, out.Capital, out.ReturnBP = &result, &average, returnBP

	return nil
}

func setItems(
	out *AttributionYear,
	base money.Currency,
	shares []attributionShare,
	weights, contributions []int,
) error {
	out.Items = make([]AttributionItem, len(shares))

	for i, sh := range shares {
		part, err := attributionPart(base, sh.result, sh.own, weights[i], contributions[i])
		if err != nil {
			return err
		}

		// A stale price measures no rate (AT5); the result stays in the sums.
		if sh.row.staleSince != nil {
			part.ReturnBP = nil
		}

		out.Items[i] = AttributionItem{
			Instrument:      sh.code,
			AttributionPart: part,
			StaleSince:      sh.row.staleSince,
		}
	}

	return nil
}

func attributionPart(
	base money.Currency,
	result int64,
	capital domain.DayCapital,
	weightBP, contributionBP int,
) (AttributionPart, error) {
	amount, err := money.New(result, base)
	if err != nil {
		return AttributionPart{}, err
	}

	return AttributionPart{
		Result:         amount,
		WeightBP:       weightBP,
		ContributionBP: contributionBP,
		ReturnBP:       ifOK(domain.RatioBP(result, capital)),
	}, nil
}
