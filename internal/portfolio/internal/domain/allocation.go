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
// and gives each its share in basis points rounded down; the last group takes the remainder so
// the shares add up to 10000. A total that is not positive has no shares.
func Allocate(items []Holding) []Group {
	byKey := map[string]int64{}
	var total int64
	for _, h := range items {
		byKey[h.Key] += h.Value
		total += h.Value
	}
	groups := make([]Group, 0, len(byKey))
	for key, value := range byKey {
		groups = append(groups, Group{Key: key, Value: value})
	}
	slices.SortFunc(groups, func(a, b Group) int {
		return cmp.Or(cmp.Compare(b.Value, a.Value), cmp.Compare(a.Key, b.Key))
	})
	if total <= 0 {
		return groups
	}
	assigned := 0
	for i := range groups {
		if i == len(groups)-1 {
			groups[i].ShareBP = 10000 - assigned
			break
		}
		groups[i].ShareBP = int(shareBP(groups[i].Value, total)) //nolint:gosec // the share of a group of a positive total lies within a few multiples of 10000
		assigned += groups[i].ShareBP
	}
	return groups
}

// shareBP is floor(value * 10000 / total) for a positive total; 128 bits hold the product.
func shareBP(value, total int64) int64 {
	share := new(big.Int).Mul(big.NewInt(value), big.NewInt(10000))
	return share.Div(share, big.NewInt(total)).Int64()
}
