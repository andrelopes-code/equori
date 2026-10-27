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

// DefaultReserveYieldPercent returns the largest yield, in percent per 30 days, that a sync books
// on a reserved balance in currency (D3, A75); 0 books none and leaves the difference open.
func DefaultReserveYieldPercent(currency money.Currency) int64 {
	switch currency {
	case "BRL":
		// 0.1% per day, above the 0.0644% per day of 140% CDI at 12.3% per year.
		return 3
	}
	return 0
}

// DefaultWithholdingBP returns the income tax withheld, in basis points, on an income type of a region when none is given (F9).
func DefaultWithholdingBP(region, incomeType string) int {
	if region == "BR" && incomeType == "jcp" {
		return 1500
	}
	return 0
}
