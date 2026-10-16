package domain

import (
	"time"

	"github.com/google/uuid"
)

type RecordState string

const (
	StateReceived    RecordState = "received"
	StateMatched     RecordState = "matched"
	StateCreated     RecordState = "created"
	StateNeedsReview RecordState = "needs_review"
	StateDiscarded   RecordState = "discarded"
	// StateWithdrawn: the aggregator stopped returning the line; its posting is released (A38).
	StateWithdrawn RecordState = "withdrawn"
)

// Aggregator line statuses (P6 A36).
const (
	ExternalPending = "PENDING"
	ExternalPosted  = "POSTED"
)

// ExternalRecord is one statement line as received, with what the import made of it.
type ExternalRecord struct {
	ID            uuid.UUID
	UserID        int64
	BatchID       uuid.UUID
	AccountID     uuid.UUID
	ExternalID    string
	DedupKey      []byte
	Raw           map[string]string
	Date          time.Time
	Amount        int64
	Description   string
	State         RecordState
	TransactionID uuid.UUID
	Candidates    []uuid.UUID

	// What an aggregator reported, to detect its later changes (P6 A36); empty for files.
	ExternalStatus string
	DueDate        *time.Time
	Installment    *Installment
	CategoryID     string
	BalanceAfter   *int64
	// UnappliedChange describes a provider change the ledger did not take.
	UnappliedChange string
}

// ExternalStatusOf is the aggregator status of a normalized line.
func ExternalStatusOf(r NormalizedRecord) string {
	if r.Pending {
		return ExternalPending
	}
	return ExternalPosted
}

// Count adds one record with the given state to the counts.
func (c *Counts) Count(s RecordState) {
	switch s {
	case StateMatched:
		c.Matched++
	case StateCreated:
		c.Created++
	case StateNeedsReview:
		c.NeedsReview++
	case StateDiscarded:
		c.Discarded++
	}
}
