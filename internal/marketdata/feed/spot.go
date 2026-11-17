package feed

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// SpotQuote is the value a source reports now for one pair (A248 CQ6).
type SpotQuote struct {
	Instrument money.Currency
	Quote      money.Currency
	Value      money.Rate
	// At is the instant of the last trade.
	At time.Time
	// Date is the trading date of At at the source, at midnight UTC (A222 T1).
	Date time.Time
	// Open reports whether the regular session of the source is running.
	Open bool
}

// Spot is a source that reports current quotes (A248 CQ7).
type Spot interface {
	// Current returns the current quote of each instrument of ins the source quotes. It returns
	// the quotes read before a failure together with the failure.
	Current(ctx context.Context, ins []Instrument) ([]SpotQuote, error)
}
