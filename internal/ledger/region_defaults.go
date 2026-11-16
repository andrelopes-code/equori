package ledger

import (
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// DefaultBaseCurrency returns the base currency a new book of a region starts with.
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

// jcpRateChange is the first day of the JCP rate of 17.5% in Brazil (Lei Complementar 224/2025).
var jcpRateChange = time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)

// DefaultWithholdingBP returns the income tax withheld, in basis points, on an income type of a
// region paid on date when none is given (F9; A235 FS1). BR taxes a JCP at 15% up to 2025-12-31
// and at 17.5% from 2026-01-01.
func DefaultWithholdingBP(region, incomeType string, date time.Time) int {
	if region != "BR" || incomeType != "jcp" {
		return 0
	}

	if date.Before(jcpRateChange) {
		return 1500
	}

	return 1750
}

// SeparatesDayTrades reports whether a sale of a book of region separates the day's purchases
// from the earlier stock (A228 IO10; BR: IN RFB 1.585/2015, art. 65).
func SeparatesDayTrades(region string) bool {
	return region == "BR"
}

// CostMethod returns how a sale of an instrument type removes cost in a book of region: the
// oldest lot first for a fixed income security in BR (Tesouro Direto sells by PEPS), the average
// cost of the holding otherwise.
func CostMethod(region, instrumentType string) string {
	if region == "BR" && instrumentType == "fixed_income" {
		return domain.CostFIFO
	}

	return domain.CostAverage
}
