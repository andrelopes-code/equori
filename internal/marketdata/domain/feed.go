package domain

import "time"

// Kinds of a feed: a price, index, expectation, curve or institution source.
const (
	FeedPrice       = "price"
	FeedIndex       = "index"
	FeedExpectation = "expectation"
	FeedCurve       = "curve"
	FeedInstitution = "institution"
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

	// Official is false for a source whose prices rank last (A222 MQ1).
	Official bool
	// Covers is the number of defined instruments the source quotes (A222 MQ25).
	Covers int
	// HistoryPending is the number of history requests of the source not yet done.
	HistoryPending int
	// SymbolOverride is true for a source that reads Instrument.Symbols (A222 MQ20).
	SymbolOverride bool

	// Current is true for a source that reports current quotes (A248 CQ25).
	Current bool
	// CurrentAt is the last request for current quotes that returned no error; CurrentError is
	// the message of the last one that failed.
	CurrentAt    *time.Time
	CurrentError *string
}
