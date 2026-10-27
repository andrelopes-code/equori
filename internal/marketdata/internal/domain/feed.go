package domain

import "time"

// Kinds of a feed: a price source or an index source.
const (
	FeedPrice = "price"
	FeedIndex = "index"
)

// Feed is a price or index source with its state for the instance (ADR 025 F5).
type Feed struct {
	ID        string
	Kind      string
	Enabled   bool
	Suggested bool
	// Last is the latest date the feed stored; nil when it stored none.
	Last  *time.Time
	Stale bool
	// LastRun and Error describe the last tick that ran the feed since the process started.
	LastRun *time.Time
	Error   *string
}
