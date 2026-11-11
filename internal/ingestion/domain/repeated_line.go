package domain

import (
	"time"

	"github.com/google/uuid"
)

// HeldBackLines returns the indexes of the lines that may repeat a stored record of the same
// date and amount (A215). A stored record claimed by the same read is another line, so it holds
// nothing back; each other record holds back one line, in line order.
func HeldBackLines(lines, stored []ExternalRecord, claimed []uuid.UUID) map[int]bool {
	type line struct {
		date   string
		amount int64
	}

	seen := make(map[uuid.UUID]bool, len(claimed))
	for _, id := range claimed {
		seen[id] = true
	}

	free := map[line]int{}

	for _, rec := range stored {
		if !seen[rec.ID] {
			free[line{rec.Date.Format(time.DateOnly), rec.Amount}]++
		}
	}

	held := map[int]bool{}

	for i, l := range lines {
		k := line{l.Date.Format(time.DateOnly), l.Amount}
		if free[k] > 0 {
			free[k]--
			held[i] = true
		}
	}

	return held
}
