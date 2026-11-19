package br

import (
	"slices"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const (
	// abroadRate is the annual rate on the financial investments held abroad (Lei 14.754/2023 art.
	// 2).
	abroadRate = 1500
	// abroadFrom is the first year of that rule (Lei 14.754/2023 art. 46).
	abroadFrom = 2024
)

// AbroadTax is the annual tax of the financial investments held abroad of each year with items,
// from 2024 (coverage row U-08): 15% of the gains and incomes less the losses of the year and
// those carried, a loss left carrying to the next years (RFB Q&A 45); the tax paid abroad on an
// income is deducted up to 15% of that income and up to the tax (Lei 14.754/2023 art. 4; RFB Q&A
// 23). The conversion of each amount to reais is the ledger's.
func (Jurisdiction) AbroadTax(items []domain.AbroadItem) []domain.AbroadYear {
	byYear := map[int][]domain.AbroadItem{}
	for _, it := range items {
		if it.Year >= abroadFrom {
			byYear[it.Year] = append(byYear[it.Year], it)
		}
	}

	years := make([]int, 0, len(byYear))
	for y := range byYear {
		years = append(years, y)
	}

	slices.Sort(years)

	var carried int64

	out := make([]domain.AbroadYear, 0, len(years))
	for _, y := range years {
		var year domain.AbroadYear

		year, carried = abroadYear(y, byYear[y], carried)
		out = append(out, year)
	}

	return out
}

// abroadYear is the tax of year from its items and the loss carried in; it returns the loss left.
func abroadYear(y int, items []domain.AbroadItem, carried int64) (domain.AbroadYear, int64) {
	out := domain.AbroadYear{Year: y, RateBP: abroadRate}

	var credit int64

	for _, it := range items {
		if it.Amount >= 0 {
			out.Gains += it.Amount
			credit += min(it.Withheld, percentOf(it.Amount, abroadRate))
		} else {
			out.Losses -= it.Amount
		}
	}

	net := out.Gains - out.Losses
	if net <= 0 {
		out.LossCarried = carried - net

		return out, out.LossCarried
	}

	out.LossUsed = min(net, carried)
	out.LossCarried = carried - out.LossUsed
	out.Base = net - out.LossUsed
	out.Tax = percentOf(out.Base, abroadRate)
	out.Credit = min(credit, out.Tax)
	out.Due = out.Tax - out.Credit

	return out, out.LossCarried
}
