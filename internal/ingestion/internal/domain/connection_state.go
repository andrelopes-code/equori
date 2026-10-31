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

// CredentialField names one credential an aggregator requires.
type CredentialField struct {
	Name   string
	Secret bool
}
