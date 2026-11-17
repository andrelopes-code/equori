package domain

import "time"

// Curve is the rates a market pays by maturity on one base date (indexer comparison IC12).
// Index is empty for a nominal curve.
type Curve struct {
	ID, Kind, Index, Currency, Source string

	Base   time.Time
	Points []CurvePoint
}

// CurvePoint is the annual rate of a maturity, an exact decimal fraction.
type CurvePoint struct {
	Maturity time.Time
	Rate     string
}
