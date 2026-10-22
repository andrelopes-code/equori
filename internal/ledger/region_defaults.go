package ledger

import "github.com/andrelopes-code/equori/internal/platform/money"

var regionBaseCurrency = map[string]money.Currency{"BR": "BRL"}

// DefaultBaseCurrency returns the base currency a new user of a region starts with.
func DefaultBaseCurrency(region string) (money.Currency, bool) {
	c, ok := regionBaseCurrency[region]
	return c, ok
}
