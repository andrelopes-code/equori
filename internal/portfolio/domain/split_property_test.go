package domain

import (
	"math/big"
	"math/rand/v2"
	"testing"
)

// AC16: over drawn portfolios, the split adds up to the amount, sells nothing and leaves the
// portfolio as close to the ideal as any purchase can.
func TestSplitGuarantee(t *testing.T) {
	t.Parallel()

	const cases = 20000

	r := rand.New(rand.NewPCG(68, 16)) //nolint:gosec // G404: a fixed seed keeps the cases

	for n := range cases {
		slots, amount := drawPlan(r)
		parts := Split(slots, amount)

		sum, total := int64(0), amount

		for i, p := range parts {
			if p < 0 {
				t.Fatalf("case %d: part %d of %v is negative", n, i, parts)
			}

			sum += p
			total += slots[i].Value
		}

		if sum != amount {
			t.Fatalf("case %d: the parts %v add up to %d, want %d", n, parts, sum, amount)
		}

		excess := new(big.Int).Sub(distance(slots, parts, total), leastDistance(slots, total))
		unit := big.NewInt(int64(2 * fullTargetBP * len(slots)))

		if excess.Cmp(unit) > 0 {
			t.Fatalf("case %d: %v for %d into %v is %s above the least distance", n, parts,
				amount, slots, excess)
		}
	}
}

// AC16 amended: with one slot held (ideal 0, its ideal moved to the next slot) the held slot
// receives nothing, the parts add up to the amount and the guarantee holds over the others.
func TestSplitGuaranteeHeld(t *testing.T) {
	t.Parallel()

	const cases = 20000

	r := rand.New(rand.NewPCG(68, 17)) //nolint:gosec // G404: a fixed seed keeps the cases

	for n := range cases {
		slots, amount := drawPlan(r)
		held := r.IntN(len(slots))
		next := (held + 1) % len(slots)

		slots[next].TargetBP += slots[held].TargetBP
		slots[held].TargetBP = 0

		parts := Split(slots, amount)
		if parts[held] != 0 {
			t.Fatalf("case %d: the held slot %d received %d", n, held, parts[held])
		}

		var sum int64

		total := amount
		rest, restParts := make([]Slot, 0, len(slots)-1), make([]int64, 0, len(slots)-1)

		for i, p := range parts {
			sum += p

			if i != held {
				rest = append(rest, slots[i])
				restParts = append(restParts, p)
				total += slots[i].Value
			}
		}

		if sum != amount {
			t.Fatalf("case %d: the parts %v add up to %d, want %d", n, parts, sum, amount)
		}

		excess := new(big.Int).Sub(distance(rest, restParts, total), leastDistance(rest, total))
		if excess.Cmp(big.NewInt(int64(2*fullTargetBP*len(rest)))) > 0 {
			t.Fatalf("case %d: %v for %d into %v is %s above the least distance", n, parts,
				amount, slots, excess)
		}
	}
}

// distance is the sum of |value + part - ideal * total| over the slots, times 10000.
func distance(slots []Slot, parts []int64, total int64) *big.Int {
	sum := new(big.Int)

	for i, s := range slots {
		sum.Add(sum, new(big.Int).Abs(gap(s, s.Value+parts[i], total)))
	}

	return sum
}

// leastDistance is twice the excess over the ideal that no purchase removes: what is above the
// ideal stays, and the rest of the slots lacks as much.
func leastDistance(slots []Slot, total int64) *big.Int {
	sum := new(big.Int)

	for _, s := range slots {
		if g := gap(s, s.Value, total); g.Sign() > 0 {
			sum.Add(sum, g)
		}
	}

	return sum.Lsh(sum, 1)
}

func gap(s Slot, value, total int64) *big.Int {
	held := new(big.Int).Mul(big.NewInt(value), big.NewInt(fullTargetBP))
	ideal := new(big.Int).Mul(big.NewInt(int64(s.TargetBP)), big.NewInt(total))

	return held.Sub(held, ideal)
}

// drawPlan draws two to ten slots whose ideals add up to 10000, one in six without value.
func drawPlan(r *rand.Rand) ([]Slot, int64) {
	slots := make([]Slot, 2+r.IntN(9))
	left := fullTargetBP

	for i := range slots {
		ideal := left
		if i < len(slots)-1 {
			ideal = r.IntN(left + 1)
		}

		left -= ideal
		slots[i].TargetBP = ideal

		if r.IntN(6) > 0 {
			slots[i].Value = r.Int64N(5_000_000)
		}
	}

	return slots, 1 + r.Int64N(3_000_000)
}
