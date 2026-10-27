// Package index reads the rates of an economic index from a public source: the anti-corruption
// layer of the accrual of fixed income securities (investments design 4.2).
package index

import (
	"context"
	"time"
)

// Rate is the rate of an index for the period that ends on Date, an exact decimal fraction
// (0.00055131 is 0.055131%).
type Rate struct {
	Date  time.Time
	Value string
}

// Periods of an index: the span one rate covers.
const (
	PeriodDay   = "day"
	PeriodMonth = "month"
)

// Source reads the rates of one index from one public source.
type Source interface {
	// ID identifies the source; it is the value of EQUORI_INDEX_FEEDS.
	ID() string
	// Index is the identifier the rates are stored under, the index_id of the terms.
	Index() string
	// Period is PeriodDay or PeriodMonth.
	Period() string
	// Fetch returns the rates published for [from, to].
	Fetch(ctx context.Context, from, to time.Time) ([]Rate, error)
}
