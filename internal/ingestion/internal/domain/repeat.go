package domain

import (
	"cmp"
	"slices"
	"time"
)

// RepeatDays is how far apart a payment and its repeat may be dated, as a pending line and its
// posted line (A91, A142).
const RepeatDays = supersedeDays

// RepeatLine is what a repeat compares of a card line (A142).
type RepeatLine struct {
	ExternalID string
	Date       time.Time
	Amount     int64
	Kind       string
}

// Repeats returns the lines that repeat a recorded payment: a credit with the amount of a
// recorded credit, dated within 3 days of it, where at least one of the two is a payment. Lines
// are taken payments first, then by date and external id; each takes the nearest recorded
// credit no earlier line took, and a line that repeats nothing counts as recorded for the
// lines after it (A142).
func Repeats(lines, recorded []RepeatLine) map[int]bool {
	var order []int
	for i, l := range lines {
		if l.Amount > 0 {
			order = append(order, i)
		}
	}
	slices.SortStableFunc(order, func(a, b int) int {
		x, y := lines[a], lines[b]
		return cmp.Or(
			cmp.Compare(rank(x), rank(y)),
			x.Date.Compare(y.Date),
			cmp.Compare(x.ExternalID, y.ExternalID),
		)
	})

	pool := slices.DeleteFunc(slices.Clone(recorded), func(r RepeatLine) bool { return r.Amount <= 0 })
	taken := make([]bool, len(pool))
	out := map[int]bool{}
	for _, i := range order {
		l := lines[i]
		if j := nearestRepeated(l, pool, taken); j >= 0 {
			taken[j], out[i] = true, true
			continue
		}
		pool, taken = append(pool, l), append(taken, false)
	}

	return out
}

// rank puts payments before the other credits.
func rank(l RepeatLine) int {
	if l.Kind == KindPayment {
		return 0
	}
	return 1
}

// nearestRepeated returns the index of the free pool credit that l repeats, nearest in date,
// or -1.
func nearestRepeated(l RepeatLine, pool []RepeatLine, taken []bool) int {
	best, gap := -1, time.Duration(0)
	for j, r := range pool {
		if taken[j] || r.Amount != l.Amount || (r.Kind != KindPayment && l.Kind != KindPayment) {
			continue
		}
		d := r.Date.Sub(l.Date).Abs()
		if d > RepeatDays*24*time.Hour {
			continue
		}
		if best < 0 || d < gap {
			best, gap = j, d
		}
	}

	return best
}
