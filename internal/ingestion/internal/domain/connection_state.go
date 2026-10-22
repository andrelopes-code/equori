package domain

// ConnectionState is the aggregator-neutral reading of a connection's provider status.
type ConnectionState string

const (
	StateOK         ConnectionState = "ok"
	StateNeedsOwner ConnectionState = "needs_owner"
	StateFailed     ConnectionState = "failed"
)

// CredentialField names one credential an aggregator requires.
type CredentialField struct {
	Name   string
	Secret bool
}
