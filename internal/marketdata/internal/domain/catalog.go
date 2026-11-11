package domain

import "github.com/andrelopes-code/equori/internal/platform/money"

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
