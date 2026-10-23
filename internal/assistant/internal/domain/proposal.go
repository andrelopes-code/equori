package domain

import (
	"time"

	"github.com/google/uuid"
)

type ProposalStatus string

const (
	ProposalPending   ProposalStatus = "pending"
	ProposalExecuting ProposalStatus = "executing"
	ProposalExecuted  ProposalStatus = "executed"
	ProposalFailed    ProposalStatus = "failed"
	ProposalRejected  ProposalStatus = "rejected"
	ProposalStale     ProposalStatus = "stale"
	ProposalDiscarded ProposalStatus = "discarded"
)

const ProposalTTL = 15 * time.Minute

// Proposal is a write the assistant asks the user to confirm. MessageID is uuid.Nil until attached and
// DecidedAt is zero until decided.
type Proposal struct {
	ID, ConversationID, MessageID uuid.UUID
	Tool                          string
	Arguments, Preview, Result    []byte
	Basis                         string
	Status                        ProposalStatus
	CreatedAt, ExpiresAt          time.Time
	DecidedAt                     time.Time
}

func (p Proposal) Expired(now time.Time) bool {
	return p.Status == ProposalPending && !now.Before(p.ExpiresAt)
}
