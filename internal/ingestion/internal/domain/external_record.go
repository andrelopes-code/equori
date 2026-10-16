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
