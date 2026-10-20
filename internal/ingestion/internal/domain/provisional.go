package domain

import (
	"cmp"
	"slices"
	"time"
)

// supersedeDays is how far apart a pending line and the posted line that replaces it may be dated.
const supersedeDays = 3

// Superseded returns the pending lines without a bill that a posted line of the same amount,
// dated within 3 days, replaces; each posted line replaces at most one, the nearest in date
// first (A91).
func Superseded(lines []NormalizedRecord) map[int]bool {
	var pending, posted []int
	for i, l := range lines {
		switch {
		case l.Pending && l.DueDate == nil:
			pending = append(pending, i)
		case !l.Pending && l.DueDate != nil:
			posted = append(posted, i)
		}
	}
	byDate := func(a, b int) int { return lines[a].Date.Compare(lines[b].Date) }
	slices.SortStableFunc(pending, byDate)
	out := map[int]bool{}
	taken := map[int]bool{}
	for _, p := range pending {
		best, gap := -1, time.Duration(0)
		for _, q := range posted {
			if taken[q] || lines[q].Amount != lines[p].Amount {
				continue
			}
			d := lines[q].Date.Sub(lines[p].Date).Abs()
			if d > supersedeDays*24*time.Hour {
				continue
			}
			if best < 0 || cmp.Compare(d, gap) < 0 {
				best, gap = q, d
			}
		}
		if best >= 0 {
			taken[best], out[p] = true, true
		}
	}
	return out
}
