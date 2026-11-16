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

// Snapshot is the latest period a source publishes.
type Snapshot struct {
	// Period is the last day of the period the figures refer to.
	Period   time.Time
	Currency string
	Entries  []Entry
}

// Source reads the indicators of the institutions of one register.
type Source interface {
	// ID identifies the source; it is a feed of ADR 025.
	ID() string
	// URL is the address of the register's own portal.
	URL() string
	// Fetch returns the latest period published on or before today.
	Fetch(ctx context.Context, today time.Time) (Snapshot, error)
}
