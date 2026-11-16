// Package institution reads the prudential indicators of financial institutions from a public
// register (A237).
package institution

import (
	"context"
	"time"
)

// Figures are the indicators of one institution or conglomerate. A nil field is a value the
// register does not inform; it is never zero.
type Figures struct {
	// Basel, PrincipalCapital and FixedAsset are exact decimal fractions (0.155 is 15.5%).
	Basel            *string
	PrincipalCapital *string
	FixedAsset       *string
	// Equity and NetIncome are integers of minor units of Snapshot.Currency.
	Equity    *int64
	NetIncome *int64
}

// Entry is the figures that an identifier of a scheme reaches.
type Entry struct {
	Scheme     string
	Identifier string
	// ConglomerateCode and ConglomerateName say whose figures these are: the conglomerate that
	// holds the institution, or the institution itself when it holds none.
	ConglomerateCode string
	ConglomerateName string
	Figures
}

// KeptPeriods is how many of the latest quarters a source keeps (A237 H1).
const KeptPeriods = 8

// Period is the figures a register published for the end of one quarter.
type Period struct {
	// End is the last day of the quarter.
	End     time.Time
	Entries []Entry
}

// Snapshot holds the periods a fetch read, newest first.
type Snapshot struct {
	Currency string
	Periods  []Period
}

// Floor is a regulatory floor, a decimal fraction: Minimum is the rule's minimum and WithBuffer
// the minimum plus the conservation buffer.
type Floor struct {
	Minimum    string
	WithBuffer string
}

// Limits are the floors of the register's jurisdiction and the rule that sets them (A237 L1).
type Limits struct {
	Basel            Floor
	PrincipalCapital Floor
	Rule             string
}

// Source reads the indicators of the institutions of one register.
type Source interface {
	// ID identifies the source; it is a feed of ADR 025.
	ID() string
	// URL is the address of the register's own portal.
	URL() string
	// Limits returns the floors of the register's jurisdiction.
	Limits() Limits
	// Fetch returns the latest period published on or before today, and each of the KeptPeriods
	// latest quarters whose end is not in have, newest first.
	Fetch(ctx context.Context, today time.Time, have []time.Time) (Snapshot, error)
}
