package domain

import (
	"math/big"
	"slices"
)

// Apportion splits amount over weights in proportion; each share is the floor of
// amount × weight ÷ Σ weights, and the units left go one each to the largest remainders, ties to
// the lower index (A228 IO18). A zero weight takes nothing; all zero weights return zeros.
func Apportion(amount int64, weights []int64) []int64 {
	shares := make([]int64, len(weights))

	sum := new(big.Int)
	for _, w := range weights {
		sum.Add(sum, big.NewInt(w))
	}

	if sum.Sign() == 0 || amount == 0 {
		return shares
	}

	remainders := make([]*big.Int, len(weights))
	left := amount

	for i, w := range weights {
		q, r := new(big.Int).DivMod(
			new(big.Int).Mul(big.NewInt(amount), big.NewInt(w)),
			sum,
			new(big.Int),
		)
		shares[i], remainders[i] = q.Int64(), r
		left -= shares[i]
	}

	order := make([]int, len(weights))
	for i := range order {
		order[i] = i
	}

	slices.SortStableFunc(order, func(a, b int) int { return remainders[b].Cmp(remainders[a]) })

	for _, i := range order[:left] {
		shares[i]++
	}

	return shares
}
