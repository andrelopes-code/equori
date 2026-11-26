package domain

import "time"

// releaseWindow is the largest time from a release line to its withdrawal line (A268 RL2):
// the owner's two observations were 211 ms and 243 ms.
const releaseWindow = 2 * time.Second

// PairLine is a line RL2 compares: its source timestamp and amount.
type PairLine struct {
	At     time.Time
	Amount int64
}

// PairReleases returns, for each release line, the index of the withdrawal line it pairs with,
// or -1 (A268 RL2). A withdrawal line follows its release line by 0 to releaseWindow and
// credits at most what the release line debits. A release line with several candidates, or
// whose one candidate another release line also claims, pairs with none.
func PairReleases(releases, withdrawals []PairLine) []int {
	out := make([]int, len(releases))
	claims := make([]int, len(withdrawals))

	for i, r := range releases {
		out[i] = -1

		for j, w := range withdrawals {
			if !pairs(r, w) {
				continue
			}

			claims[j]++

			// -2 marks a release line with several candidates.
			if out[i] == -1 {
				out[i] = j
			} else {
				out[i] = -2
			}
		}
	}

	for i, j := range out {
		if j < 0 || claims[j] > 1 {
			out[i] = -1
		}
	}

	return out
}

// ReserveConfirms reports whether a reserve's reported amount holds the release lines of its
// pairs (A268 RL3): what it adds to the settled balance less the released amount lies between
// 0 and bound, the yield D3 can book.
func ReserveConfirms(reported, settled, released, bound int64) bool {
	d := reported - (settled - released)

	return d >= 0 && d <= bound
}

func pairs(release, withdrawal PairLine) bool {
	if release.At.IsZero() || withdrawal.At.IsZero() {
		return false
	}

	gap := withdrawal.At.Sub(release.At)

	return gap >= 0 && gap <= releaseWindow && withdrawal.Amount <= -release.Amount
}
