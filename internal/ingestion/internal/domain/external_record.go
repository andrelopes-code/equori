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
	BooksID       int64
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
	// ReviewReason is why the record waits for review, and Scores its candidates as matching
	// scored them (A100–A102).
	ReviewReason string
	Scores       []Scored

	// What an aggregator reported, to detect its later changes (P6 A36); empty for files.
	ExternalStatus string
	InstitutionID  string
	// ReportedAmount and ReportedOn are the institution's last report; Amount and Date
	// hold the ledger's values (A147).
	ReportedAmount int64
	ReportedOn     time.Time
	DueDate        *time.Time
	Installment    *Installment
	CategoryID     string
	BalanceAfter   *int64
	// LineKind is the card line type the ledger was given (A88).
	LineKind string
	// UnappliedChange describes an aggregator change the ledger did not take.
	UnappliedChange string
	// Decision is the record's last automatic decision, empty when none is undoable, and Undo
	// what undoing it restores (A148).
	Decision DecisionKind
	Undo     Undo
	// SummaryBatchID is the batch of the sync run whose summary lists the record (A149).
	SummaryBatchID uuid.UUID
	// Kept: the owner undid the record's withdrawal; withdrawal skips it (A148).
	Kept bool
	// GroupIDs are the other lines of the group of a record in review reason group; it is
	// computed when the record is read and never stored (A168).
	GroupIDs []uuid.UUID
}

// Why a record waits for review (A100, A102, A142); the first two are the zones of Assign.
const (
	ReviewAmbiguous = string(ZoneAmbiguous)
	ReviewProbable  = string(ZoneProbable)
	ReviewChanged   = "changed"
	ReviewRepeated  = "repeated"
	ReviewGroup     = "group"
)

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
