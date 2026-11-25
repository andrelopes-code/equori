// Package sentiment reads the daily value of an index that measures the mood of a market
// (contribution conditions CO17).
package sentiment

import (
	"context"
	"time"
)

// Value is the value of an index on Date, whole, from 0 to 100.
type Value struct {
	Date  time.Time
	Value int
}

// Source reads one sentiment index from one public source.
type Source interface {
	// ID identifies the source; it is a feed of ADR 025.
	ID() string
	// Index is the identifier the values are stored under.
	Index() string
	// Fetch returns the newest days values, the whole series when days is 0.
	Fetch(ctx context.Context, days int) ([]Value, error)
}
