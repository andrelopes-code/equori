package app

import (
	"bytes"
	"math/big"
	"slices"

	"github.com/google/uuid"
)

// distribute splits x over the categories in proportion to weights: ⌊x·w/D⌋ each, and the
// amount left to the largest weight, ties to the lowest category id (CV5).
func distribute(x int64, weights Shares) Shares {
	return scale(x, sum(weights), weights)
}

// scale gives each category ⌊x·w/d⌋ and the amount left by the rounding to the largest
// weight in absolute value, ties to the lowest category id.
func scale(x, d int64, weights Shares) Shares {
	out := Shares{}
	if d == 0 || len(weights) == 0 {
		return out
	}

	ids := make([]uuid.UUID, 0, len(weights))
	for id := range weights {
		ids = append(ids, id)
	}

	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	var given int64

	largest := ids[0]
	for _, id := range ids {
		w := weights[id]
		out[id] = floorDiv(x, w, d)

		given += out[id]
		if abs(w) > abs(weights[largest]) {
			largest = id
		}
	}

	out[largest] += floorDiv(x, sum(weights), d) - given

	return out
}

// floorDiv is ⌊a·b/d⌋ without overflow.
func floorDiv(a, b, d int64) int64 {
	q, m := new(big.Int).DivMod(new(big.Int).Mul(big.NewInt(a), big.NewInt(b)), big.NewInt(d), new(big.Int))
	// DivMod is Euclidean: for a negative divisor it rounds up when there is a remainder.
	if d < 0 && m.Sign() != 0 {
		q.Sub(q, big.NewInt(1))
	}

	return q.Int64()
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}

	return v
}

func sum(s Shares) int64 {
	var n int64
	for _, v := range s {
		n += v
	}

	return n
}

func add(to, from Shares) {
	for id, v := range from {
		to[id] += v
	}
}

func negate(s Shares) Shares {
	out := make(Shares, len(s))
	for id, v := range s {
		out[id] = -v
	}

	return out
}

func clone(s Shares) Shares {
	out := make(Shares, len(s))
	add(out, s)

	return out
}
