package app

import (
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// fromCycleStart keeps, on a card's first sync, the lines of the bills due after the last
// bill closed before syncFrom and the unbilled lines from that bill's closing on, and
// returns that bill, which opens the card (A93). Without such a bill the read keeps the
// lines from syncFrom.
func fromCycleStart(
	read domain.AccountRead,
	syncFrom, from time.Time,
) (domain.AccountRead, *domain.Bill, time.Time) {
	var prev *domain.Bill
	for i, b := range read.Bills {
		closed := b.Due
		if b.Closing != nil {
			closed = *b.Closing
		}

		if closed.Before(syncFrom) && (prev == nil || b.Due.After(prev.Due)) {
			prev = &read.Bills[i]
		}
	}

	start := syncFrom
	if prev != nil {
		start = prev.Due.AddDate(0, 0, -closingMargin)
		if prev.Closing != nil {
			start = prev.Closing.AddDate(0, 0, -closingMargin)
		}
	}

	var kept []domain.NormalizedRecord
	for _, r := range read.Records {
		switch {
		case r.DueDate != nil && prev != nil:
			if r.DueDate.After(prev.Due) {
				kept = append(kept, r)
			}
		case !r.Date.Before(start):
			kept = append(kept, r)
		}
	}

	read.Records = kept

	if start.Before(from) {
		from = start
	}

	return read, prev, from
}

// withCreated adds the lines created since the last read to the records: one whose id the
// date read returned is dropped, and so is one dated before syncFrom (A144, A145).
func withCreated(read domain.AccountRead, syncFrom time.Time) domain.AccountRead {
	for _, r := range read.Created {
		if r.Date.Before(syncFrom) || slices.Contains(read.Seen, r.ExternalID) {
			continue
		}

		read.Records = append(read.Records, r)
	}

	return read
}

// withoutSuperseded drops the pending lines that a posted line of the same read replaces:
// a stored one is then withdrawn and its transaction waits for the posted line (A91).
func withoutSuperseded(read domain.AccountRead) domain.AccountRead {
	gone := domain.Superseded(read.Records)
	if len(gone) == 0 {
		return read
	}

	dropped := map[string]bool{}

	var kept []domain.NormalizedRecord
	for i, r := range read.Records {
		if gone[i] {
			dropped[r.ExternalID] = true
			continue
		}

		kept = append(kept, r)
	}

	read.Records = kept
	read.Seen = slices.DeleteFunc(
		slices.Clone(read.Seen),
		func(id string) bool { return dropped[id] },
	)

	return read
}

// fromSyncStart drops the lines dated before syncFrom, which bounds the import (A35, A145);
// Seen keeps them, so that a stored record is not withdrawn for a line the read returned.
func fromSyncStart(read domain.AccountRead, syncFrom time.Time) domain.AccountRead {
	read.Records = slices.DeleteFunc(
		slices.Clone(read.Records),
		func(r domain.NormalizedRecord) bool {
			return r.Date.Before(syncFrom)
		},
	)

	return read
}
