// Package expectation reads the expected path of an index from a public survey (ADR 026).
package expectation

import (
	"context"
	"time"
)

// Point is the expected annual rate of an index on Date, an exact decimal fraction (0.1315 is
// 13.15% a year).
type Point struct {
	Date time.Time
	Rate string
}

// Survey is the latest publication of a source.
type Survey struct {
	Date   time.Time
	Points []Point
}

// Source reads the expectations of one index from one public survey.
type Source interface {
	// ID identifies the source; it is a feed of ADR 025.
	ID() string
	// Index is the identifier of the index the points project.
	Index() string
	// Fetch returns the latest survey.
	Fetch(ctx context.Context) (Survey, error)
}
