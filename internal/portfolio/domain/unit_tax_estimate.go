package domain

import "math/big"

// UnitTaxEstimate is the come-cotas of units valued valueNow, whose cost is cost and whose value
// at the previous come-cotas was valuePrev (zero when unknown): rateBP of the gain above the later
// of the two, half to even, never below zero (Lei 14.754/2023 art. 17; coverage row U-01).
// shortcut: a loss of an earlier period does not reduce the gain; upgrade when the ledger keeps
// the loss of each fund.
func UnitTaxEstimate(valueNow, cost, valuePrev int64, rateBP int) int64 {
	gain := valueNow - max(cost, valuePrev)
	if gain <= 0 || rateBP <= 0 {
		return 0
	}

	num := new(big.Int).Mul(big.NewInt(gain), big.NewInt(int64(rateBP)))

	return divHalfEven(num, big.NewInt(10000))
}
