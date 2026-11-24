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

// BusinessDayCompounding is implemented by a Source whose index compounds by business day: a fixed
// income security on it compounds the rate of each published business day times its percent and
// may count bus252 days. A Source without it compounds by ended month.
type BusinessDayCompounding interface {
	CompoundsByBusinessDay() bool
}

// Calendared is implemented by a Source that publishes one rate each business day of a calendar of
// the registry: a business day between two rates without one is a hole (A265 RI3).
type Calendared interface {
	// Calendar is the identifier of the calendar, empty for none.
	Calendar() string
}

// HistoryStart is implemented by a Source whose index a security of its region counts from a date
// more than the default history back, such as the base of the VNA of a government bond: the store
// holds its rates from that date.
type HistoryStart interface {
	HistorySince() time.Time
}

// Source reads the rates of one index from one public source.
type Source interface {
	// ID identifies the source; it is the id of its marketdata_feed row.
	ID() string
	// Index is the identifier the rates are stored under, the index_id of the terms.
	Index() string
	// Period is PeriodDay or PeriodMonth.
	Period() string
	// Fetch returns the rates published for [from, to].
	Fetch(ctx context.Context, from, to time.Time) ([]Rate, error)
}
