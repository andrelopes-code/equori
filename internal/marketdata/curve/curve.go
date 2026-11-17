// Package curve reads the rates a market pays by maturity (indexer comparison IC9).
package curve

import (
	"context"
	"time"
)

const (
	KindNominal = "nominal"
	KindReal    = "real"
)

// Info describes a curve a source serves. Index is empty for a nominal curve.
type Info struct{ ID, Kind, Index, Currency string }

// Point is the annual rate of a maturity, an exact decimal fraction.
type Point struct {
	Maturity time.Time
	Rate     string
}

// Curve is the points of one curve on its base date.
type Curve struct {
	ID     string
	Base   time.Time
	Points []Point
}

type Source interface {
	ID() string
	Describe() []Info
	// Fetch returns nil when the file did not change since the last fetch of the process.
	Fetch(ctx context.Context) ([]Curve, error)
}
