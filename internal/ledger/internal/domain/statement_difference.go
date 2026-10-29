package domain

import (
	"cmp"
	"slices"
	"time"

	"github.com/google/uuid"
)

// maxDifferenceCandidates bounds the subset search of ExplainDifference to 2^20 subsets.
const maxDifferenceCandidates = 20

// DifferenceCandidate is a provisional posting of a closed statement (A137).
type DifferenceCandidate struct {
	TransactionID uuid.UUID
	Date          time.Time
	Amount        int64 // ledger sign: a charge is negative
}

// DifferenceExplanation names the postings whose move to the next statement closes a
// statement's difference with the institution (A137).
type DifferenceExplanation struct {
	Move     []uuid.UUID // nil when no subset closes the difference
	Rounding bool        // no subset found and |difference| <= one minor unit per line
}

// ExplainDifference finds the smallest set of candidates whose move to the next statement
// lowers the amount due by difference (amount due − institution total). Among sets of one
// size, the latest dates win, then the lowest transaction ids. Only the 20 latest candidates
// enter the search.
func ExplainDifference(difference int64, lineCount int, candidates []DifferenceCandidate) DifferenceExplanation {
	if difference == 0 {
		return DifferenceExplanation{}
	}

	sorted := slices.SortedFunc(slices.Values(candidates), func(a, b DifferenceCandidate) int {
		return cmp.Or(b.Date.Compare(a.Date), slices.Compare(a.TransactionID[:], b.TransactionID[:]))
	})
	sorted = sorted[:min(len(sorted), maxDifferenceCandidates)]

	for size := 1; size <= len(sorted); size++ {
		if picked := pick(sorted, size, difference); picked != nil {
			return DifferenceExplanation{Move: picked}
		}
	}

	return DifferenceExplanation{Rounding: max(difference, -difference) <= int64(lineCount)}
}

// pick returns the first combination of size candidates, in index order, whose moved amount
// equals target; a moved posting lowers the amount due by −Amount.
func pick(cs []DifferenceCandidate, size int, target int64) []uuid.UUID {
	chosen := make([]int, 0, size)
	var walk func(from int, left int64) bool
	walk = func(from int, left int64) bool {
		if len(chosen) == size {
			return left == 0
		}
		for i := from; i <= len(cs)-(size-len(chosen)); i++ {
			chosen = append(chosen, i)
			if walk(i+1, left+cs[i].Amount) {
				return true
			}
			chosen = chosen[:len(chosen)-1]
		}
		return false
	}
	if !walk(0, target) {
		return nil
	}

	out := make([]uuid.UUID, size)
	for k, i := range chosen {
		out[k] = cs[i].TransactionID
	}

	return out
}
