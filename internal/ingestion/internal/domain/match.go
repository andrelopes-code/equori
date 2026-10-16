package domain

import (
	"time"

	"github.com/google/uuid"
)

// MatchWindow is the distance in days between a statement line and the transaction it
// confirms (chapter 3, F4).
const MatchWindow = 3

// LedgerPosting is a posting of the account that no external record confirms yet.
type LedgerPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Amount        int64
}

// Candidates returns, in date order, the transactions a line may confirm: a posting with the
// same amount within MatchWindow days whose transaction no earlier line took (I07).
func Candidates(date time.Time, amount int64, postings []LedgerPosting, taken map[uuid.UUID]bool) []uuid.UUID {
	var out []uuid.UUID
	seen := map[uuid.UUID]bool{}
	for _, p := range postings {
		days := p.Date.Sub(date).Hours() / 24
		if p.Amount != amount || days < -MatchWindow || days > MatchWindow || taken[p.TransactionID] || seen[p.TransactionID] {
			continue
		}
		seen[p.TransactionID] = true
		out = append(out, p.TransactionID)
	}
	return out
}
