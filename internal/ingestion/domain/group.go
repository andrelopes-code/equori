package domain

import (
	"bytes"
	"slices"
	"time"

	"github.com/google/uuid"
)

const (
	// groupSpreadDays is the largest distance in days between two lines of a group (A167).
	groupSpreadDays = 3
	// groupEligibleMax is the most lines searched for one entry (A168).
	groupEligibleMax = 40
)

// GroupLine is a line a group may hold. New is true for a line of the batch in zone New (A167).
type GroupLine struct {
	RecordID uuid.UUID
	Date     time.Time
	Amount   int64
	New      bool
}

// GroupMatch is the group proposed for an entry: its lines, ascending by id.
type GroupMatch struct {
	TransactionID uuid.UUID
	RecordIDs     []uuid.UUID
}

// FindGroups decides every entry (A168): a match for an entry with exactly one group whose lines
// belong to no group of another entry. The entries and the lines belong to one account.
func FindGroups(entries []LedgerPosting, lines []GroupLine) []GroupMatch {
	found := make([][][]uuid.UUID, len(entries))
	owners := map[uuid.UUID]map[uuid.UUID]bool{}
	seen := map[uuid.UUID]bool{}

	for i, e := range entries {
		if seen[e.TransactionID] {
			continue
		}

		seen[e.TransactionID] = true
		found[i] = groupsOf(e, lines)

		for _, g := range found[i] {
			for _, id := range g {
				if owners[id] == nil {
					owners[id] = map[uuid.UUID]bool{}
				}

				owners[id][e.TransactionID] = true
			}
		}
	}

	shared := func(id uuid.UUID) bool { return len(owners[id]) > 1 }

	var out []GroupMatch

	for i, e := range entries {
		if len(found[i]) != 1 || slices.ContainsFunc(found[i][0], shared) {
			continue
		}

		out = append(out, GroupMatch{TransactionID: e.TransactionID, RecordIDs: found[i][0]})
	}

	return out
}

// groupsOf lists the groups of A167 for one entry, pairs and triples of lines, each ascending by
// id and all in ascending order; nil when the entry has none or more than groupEligibleMax
// eligible lines.
func groupsOf(e LedgerPosting, lines []GroupLine) [][]uuid.UUID {
	if e.Amount == 0 {
		return nil
	}

	var eligible []GroupLine

	for _, l := range lines {
		sameSign := (l.Amount < 0) == (e.Amount < 0)
		if l.Amount != 0 && sameSign && dayGap(l.Date, e.Date) <= MatchHardLimit {
			eligible = append(eligible, l)
		}
	}

	if len(eligible) > groupEligibleMax {
		return nil
	}

	slices.SortFunc(eligible, func(a, b GroupLine) int {
		return bytes.Compare(a.RecordID[:], b.RecordID[:])
	})

	var out [][]uuid.UUID

	for i := range eligible {
		for j := i + 1; j < len(eligible); j++ {
			out = appendGroup(out, e, eligible[i], eligible[j])

			for k := j + 1; k < len(eligible); k++ {
				out = appendGroup(out, e, eligible[i], eligible[j], eligible[k])
			}
		}
	}

	return out
}

func appendGroup(out [][]uuid.UUID, e LedgerPosting, members ...GroupLine) [][]uuid.UUID {
	if !holds(e, members) {
		return out
	}

	ids := make([]uuid.UUID, len(members))
	for i, m := range members {
		ids[i] = m.RecordID
	}

	return append(out, ids)
}

// holds reports whether the lines meet conditions 2, 4, 5 and 6 of A167; the caller met 1 and 3.
func holds(e LedgerPosting, members []GroupLine) bool {
	var sum int64

	anchor, fresh := false, false

	for i, m := range members {
		sum += m.Amount
		anchor = anchor || withinBound(m.Amount, e.Amount)
		fresh = fresh || m.New

		for _, o := range members[:i] {
			if dayGap(m.Date, o.Date) > groupSpreadDays {
				return false
			}
		}
	}

	return sum == e.Amount && anchor && fresh
}
