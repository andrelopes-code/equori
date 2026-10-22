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

// DefaultForeignChargeBP returns the foreign purchase charge, in basis points, a new card of a region starts with.
func DefaultForeignChargeBP(region string) int {
	switch region {
	case "BR":
		return 350
	}
	return 0
}
