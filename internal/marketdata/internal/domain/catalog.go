package domain

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Listing is a catalog entry of one source, marked when the instance defines its code (A222 MQ29).
type Listing struct {
	Code          money.Currency
	Name          string
	Type          string
	Exchange      string
	QuoteCurrency money.Currency
	Symbol        string
	Source        string
	Defined       bool
}

// CatalogResult is the answer of a catalog search.
type CatalogResult struct {
	Items       []Listing
	Unavailable []string
}

// ProbeQuote is what one enabled source answered for an instrument not yet defined (A222 MQ27).
type ProbeQuote struct {
	Source string
	Date   *time.Time // nil when the source returned no quote
	Value  money.Rate
	Error  string // empty when the source did not fail
}

// ProbeResult is the answer of a probe.
type ProbeResult struct {
	Quotes    []ProbeQuote
	Available []string
}
