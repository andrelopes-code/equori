package domain

import "time"

// TaxBand is a rate of income tax for holding periods up to UpToDays days; the last band of a
// table has UpToDays 0 and has no limit. Rates are in basis points.
type TaxBand struct {
	UpToDays int
	RateBP   int
}

// WithholdingTable is the tax a region withholds on the gain of a fixed income security: income
// tax by the days since each purchase, and IOF by day, IOF[d-1] being the rate of day d in
// basis points of the gain (no IOF after the last day of the list).
type WithholdingTable struct {
	IncomeTax []TaxBand
	IOF       []int
}

// Withholding is the estimated tax of a sale in minor units of the base currency.
type Withholding struct {
	IncomeTax, IOF int64
}

// EstimateWithholding returns the tax withheld on the sale on date of the lots consumed for
// proceeds. The proceeds split over the lots by units; a lot with a gain pays IOF on the gain
// and income tax on the gain less the IOF, at the rates of the days it was held.
func EstimateWithholding(
	table WithholdingTable,
	consumed []Lot,
	proceeds int64,
	on time.Time,
) (w Withholding) {
	var units int64
	for _, l := range consumed {
		units += l.Quantity
	}

	var assigned int64

	for i, l := range consumed {
		share := lotShare(proceeds, l.Quantity, units)
		if i == len(consumed)-1 {
			share = proceeds - assigned
		}

		assigned += share

		gain := share - l.Cost
		if gain <= 0 {
			continue
		}

		days := int(on.Sub(l.AcquiredOn).Hours() / 24)
		iof := lotShare(gain, int64(table.iofBP(days)), 10000)
		w.IOF += iof
		w.IncomeTax += lotShare(gain-iof, int64(table.incomeTaxBP(days)), 10000)
	}

	return w
}

func (t WithholdingTable) incomeTaxBP(days int) int {
	for _, b := range t.IncomeTax {
		if b.UpToDays == 0 || days <= b.UpToDays {
			return b.RateBP
		}
	}

	return 0
}

func (t WithholdingTable) iofBP(days int) int {
	if days < 1 || days > len(t.IOF) {
		return 0
	}

	return t.IOF[days-1]
}
