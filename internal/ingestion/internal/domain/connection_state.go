package domain

import "time"

// ConnectionState is the aggregator-neutral reading of a connection's provider status.
type ConnectionState string

const (
	StateOK         ConnectionState = "ok"
	StateNeedsOwner ConnectionState = "needs_owner"
	StateFailed     ConnectionState = "failed"

	StateStalled         ConnectionState = "stalled"
	StateConsentExpiring ConnectionState = "consent_expiring"
)

const (
	// StallAfter is the age of the institution's data past which a ready connection is stalled (A150).
	StallAfter = 72 * time.Hour
	// ConsentNotice is how long before its expiry a consent reads expiring (A151).
	ConsentNotice = 14 * 24 * time.Hour
)

// StateAt reads the connection at now from base, the aggregator's reading of its provider
// status (A146, A150, A151).
func (c Connection) StateAt(base ConnectionState, now time.Time) ConnectionState {
	if base == StateNeedsOwner || (c.ConsentExpiresAt != nil && !now.Before(*c.ConsentExpiresAt)) {
		return StateNeedsOwner
	}

	if base == StateFailed {
		return base
	}

	if base == StateOK && (olderThan(c.LastItemUpdateAt, now, StallAfter) || olderThan(c.LastSyncedAt, now, StallAfter)) {
		return StateStalled
	}

	if c.ConsentExpiresAt != nil && !now.Before(c.ConsentExpiresAt.Add(-ConsentNotice)) {
		return StateConsentExpiring
	}

	return base
}

// CredentialField names one credential an aggregator requires.
type CredentialField struct {
	Name   string
	Secret bool
}

// olderThan reports whether t is more than age before now; a nil instant measures nothing.
func olderThan(t *time.Time, now time.Time, age time.Duration) bool {
	return t != nil && now.Sub(*t) > age
}
