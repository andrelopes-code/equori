package domain

import (
	"maps"
	"slices"
	"strings"
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
	ProposalWaiting   ProposalStatus = "waiting"
	ProposalBlocked   ProposalStatus = "blocked"
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
	Suggested                     bool
	Reason, Summary               string
	// Refs maps a JSON pointer of Arguments to "<proposal id>[#<pointer of its result>]" (spec 2026-11-03 §4.1).
	Refs                 map[string]string
	CreatedAt, ExpiresAt time.Time
	DecidedAt            time.Time
}

func (p Proposal) Expired(now time.Time) bool {
	return (p.Status == ProposalPending || p.Status == ProposalWaiting) && !now.Before(p.ExpiresAt)
}

// WaitingFor returns the proposal IDs of Refs, in the order of the sorted keys, without repeats.
func (p Proposal) WaitingFor() []uuid.UUID {
	var ids []uuid.UUID

	for _, key := range slices.Sorted(maps.Keys(p.Refs)) {
		raw, _, _ := strings.Cut(p.Refs[key], "#")

		id, err := uuid.Parse(raw)
		if err != nil || slices.Contains(ids, id) {
			continue
		}

		ids = append(ids, id)
	}

	return ids
}
