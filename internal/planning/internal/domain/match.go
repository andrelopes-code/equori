package domain

import (
	"math/bits"
	"time"

	"github.com/google/uuid"
)

// MatchWindowDays bounds the distance between a transaction and the occurrence it realizes
// (P7 amendment A51).
const MatchWindowDays = 7

// Transaction is the part of a ledger transaction realization reads.
type Transaction struct {
	ID       uuid.UUID
	Date     time.Time
	PayeeID  uuid.UUID
	Voided   bool
	Postings []Posting
}

type Posting struct {
	AccountID uuid.UUID
	Amount    int64
}

// On returns the sum of t's postings on account and whether any posting names it.
func (t Transaction) On(account uuid.UUID) (int64, bool) {
	var sum int64
	found := false
	for _, p := range t.Postings {
		if p.AccountID == account {
			sum += p.Amount
			found = true
		}
	}
	return sum, found
}

type Candidate struct {
	Occurrence Occurrence
	Schedule   Schedule
}

// Fits applies the criteria of A51 except the state of the occurrence.
func Fits(t Transaction, c Candidate) bool {
	s, o := c.Schedule, c.Occurrence
	if t.Voided || absDays(t.Date, o.ExpectedOn) > MatchWindowDays {
		return false
	}
	if s.PayeeID != uuid.Nil && t.PayeeID != s.PayeeID {
		return false
	}
	if _, ok := t.On(s.CounterpartID); !ok {
		return false
	}
	sum, ok := t.On(s.AccountID)
	if !ok {
		return false
	}
	amount := sum
	if s.Kind.Outflow() {
		amount = -sum
	}
	if amount <= 0 {
		return false
	}
	diff := amount - o.Amount
	if diff < 0 {
		diff = -diff
	}
	// |A − E| × 10000 ≤ E × tolerance, in 128 bits: amounts reach 2^53.
	return !greater(uint64(diff), 10000, uint64(o.Amount), uint64(s.ToleranceBP)) //nolint:gosec // diff, amount and tolerance are non-negative here
}

// Match returns the fitting candidate closest to the transaction date, then the lower sequence.
func Match(t Transaction, cs []Candidate) (Candidate, bool) {
	var best Candidate
	found := false
	for _, c := range cs {
		if !Fits(t, c) {
			continue
		}
		if !found || closer(t.Date, c.Occurrence, best.Occurrence) {
			best, found = c, true
		}
	}
	return best, found
}

func closer(d time.Time, a, b Occurrence) bool {
	da, db := absDays(d, a.ExpectedOn), absDays(d, b.ExpectedOn)
	if da != db {
		return da < db
	}
	if !a.ExpectedOn.Equal(b.ExpectedOn) {
		return a.ExpectedOn.Before(b.ExpectedOn)
	}
	return a.Sequence < b.Sequence
}

func absDays(a, b time.Time) int {
	d := int(a.Sub(b).Hours() / 24)
	if d < 0 {
		return -d
	}
	return d
}

// greater reports whether a×b > c×d without overflow.
func greater(a, b, c, d uint64) bool {
	h1, l1 := bits.Mul64(a, b)
	h2, l2 := bits.Mul64(c, d)
	return h1 > h2 || (h1 == h2 && l1 > l2)
}
