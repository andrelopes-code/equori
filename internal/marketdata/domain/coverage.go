package domain

import "time"

// Coverage is what the instance stores of the prices of one instrument (A222 MQ23).
type Coverage struct {
	First, Last *time.Time // nil when Count is 0
	Count       int
	Stale       bool
	// Missing is the number of sessions that no enabled source holds a price of (A265 PH6).
	Missing int
	Sources []SourceCoverage
}

// SourceCoverage is one registered price source that quotes the instrument.
type SourceCoverage struct {
	ID                string
	Enabled, Official bool
	First, Last       *time.Time
	History           *History
}

// History is the request of marketdata_history for one source and instrument (A222 MQ4).
type History struct {
	From  time.Time
	Done  bool
	Error string // empty when the last attempt did not fail
}
