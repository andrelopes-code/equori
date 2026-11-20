package domain

import (
	"cmp"
	"math/big"
	"slices"
	"time"
)

// SharesBP splits total basis points among parts in proportion to their exact values, so the
// rounded parts add up to total (largest remainder, AT9): each part takes the floor of its exact
// share, and the units left go to the largest remainders, the earlier part first on a tie. A
// share may be negative; the floor is then toward minus infinity. total is the rounded sum of
// the parts, so the floors never exceed it.
func SharesBP(parts []*big.Rat, total int) []int {
	out := make([]int, len(parts))
	if len(parts) == 0 {
		return out
	}

	type rest struct {
		i int
		r *big.Rat
	}

	rests := make([]rest, len(parts))
	given := 0

	for i, p := range parts {
		floor := new(big.Int).Div(p.Num(), p.Denom())
		out[i] = int(floor.Int64())
		given += out[i]
		rests[i] = rest{i, new(big.Rat).Sub(p, new(big.Rat).SetInt(floor))}
	}

	slices.SortStableFunc(rests, func(a, b rest) int { return cmp.Compare(b.r.Cmp(a.r), 0) })

	for k := 0; given < total; k++ {
		out[rests[k%len(rests)].i]++
		given++
	}

	return out
}

// ShareOf is part ÷ whole × 10000 as an exact rational; nil when whole is not positive.
func ShareOf(part, whole *big.Int) *big.Rat {
	if whole.Sign() <= 0 {
		return nil
	}

	r := new(big.Rat).SetFrac(new(big.Int).Mul(part, big.NewInt(10000)), whole)

	return r
}

// Average is the capital per day, rounded half to even; zero for an empty period.
func (c DayCapital) Average() int64 {
	if c.Days <= 0 {
		return 0
	}

	return halfEven(new(big.Rat).SetFrac(c.Sum, big.NewInt(c.Days)))
}

// ContributionOf is result ÷ (c ÷ days) × 10000 as an exact rational: the points a result adds to
// the return on c (AT9); nil when c is not positive.
func ContributionOf(result int64, c DayCapital) *big.Rat {
	num := new(big.Int).Mul(big.NewInt(result), big.NewInt(c.Days))

	return ShareOf(num, c.Sum)
}

// RealOnCapital is the return net of inflation of a result beside what an index would have earned
// on the same capital (AT12): (capital + result) ÷ (capital + indexResult) − 1 in basis points,
// rounded half to even, capital being c ÷ days; ok is false when a side is not positive.
func RealOnCapital(result, indexResult int64, c DayCapital) (bp int, ok bool) {
	days := big.NewInt(c.Days)
	num := new(big.Int).Add(c.Sum, new(big.Int).Mul(big.NewInt(result), days))
	den := new(big.Int).Add(c.Sum, new(big.Int).Mul(big.NewInt(indexResult), days))

	if c.Days <= 0 || num.Sign() <= 0 || den.Sign() <= 0 {
		return 0, false
	}

	// (num − den) ÷ den × 10000.
	diff := new(big.Int).Sub(num, den)

	return int(halfEven(new(big.Rat).SetFrac(diff.Mul(diff, big.NewInt(10000)), den))), true
}

// MeasuredStart is the day before the money of a period is at work (AT13): start when it opens
// with a value or has no flow, else the day before its first flow.
func MeasuredStart(start time.Time, opening int64, flows []CashFlow) time.Time {
	if opening != 0 || len(flows) == 0 {
		return start
	}

	first := flows[0].Date
	for _, f := range flows[1:] {
		if f.Date.Before(first) {
			first = f.Date
		}
	}

	if d := first.AddDate(0, 0, -1); d.After(start) {
		return d
	}

	return start
}
