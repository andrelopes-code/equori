package domain

import (
	"cmp"
	"math/big"
	"slices"
)

// Holding is a value, in minor units of one currency, held under a key of the allocation.
type Holding struct {
	Key   string
	Value int64
}

// Group is the value of a key and its share of the total in basis points.
type Group struct {
	Key     string
	Value   int64
	ShareBP int
}

// Allocate sums the holdings by key, orders the groups by value (largest first, ties by key)
// and gives each positive group its share, in basis points rounded down, of the sum of the
// positive groups; the last positive group takes the remainder so the shares add up to 10000.
// A group that is not positive (a brokerage cash balance below zero) has no share: counted in
// the base, it would push the others above 10000.
func Allocate(items []Holding) []Group {
	byKey := map[string]int64{}
	for _, h := range items {
		byKey[h.Key] += h.Value
	}

	groups := make([]Group, 0, len(byKey))
	for key, value := range byKey {
		groups = append(groups, Group{Key: key, Value: value})
	}

	slices.SortFunc(groups, func(a, b Group) int {
		return cmp.Or(cmp.Compare(b.Value, a.Value), cmp.Compare(a.Key, b.Key))
	})

	// Sorted by value, the positive groups come first.
	positive := 0

	var base int64
	for _, g := range groups {
		if g.Value <= 0 {
			break
		}

		base += g.Value
		positive++
	}

	assigned := 0
	for i := range positive {
		if i == positive-1 {
			groups[i].ShareBP = 10000 - assigned
			break
		}

		//nolint:gosec // the share of a positive group of a base that contains it is at most 10000
		groups[i].ShareBP = int(shareBP(groups[i].Value, base))
		assigned += groups[i].ShareBP
	}

	return groups
}

// shareBP is floor(value * 10000 / total) for a positive total; 128 bits hold the product.
func shareBP(value, total int64) int64 {
	share := new(big.Int).Mul(big.NewInt(value), big.NewInt(10000))
	return share.Div(share, big.NewInt(total)).Int64()
}
