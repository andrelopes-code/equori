package ledger

import "github.com/andrelopes-code/equori/internal/platform/money"

// DefaultBaseCurrency returns the base currency a new user of a region starts with.
func DefaultBaseCurrency(region string) (money.Currency, bool) {
	switch region {
	case "BR":
		return "BRL", true
	}
	return "", false
}
