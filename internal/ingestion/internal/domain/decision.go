package domain

import (
	"time"

	"github.com/google/uuid"
)

// DecisionKind names an automatic decision of a sync that the owner can undo (P12 A148).
type DecisionKind string

const (
	DecisionLinked       DecisionKind = "linked"
	DecisionFollowed     DecisionKind = "followed"
	DecisionWithdrawn    DecisionKind = "withdrawn"
	DecisionReidentified DecisionKind = "re_identified"
)

// Undo holds what undoing a decision restores; each kind fills its own fields (A148).
type Undo struct {
	// Amount and On are the ledger's amount and date before a followed change.
	Amount int64
	On     time.Time
	// State, TransactionID and ReviewReason are the record before its withdrawal.
	State         RecordState
	TransactionID uuid.UUID
	ReviewReason  string
	// ExternalID, DedupKey and Raw are the record before its re-identification.
	ExternalID string
	DedupKey   []byte
	Raw        map[string]string
}
