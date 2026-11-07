package portfolio

import "github.com/andrelopes-code/equori/internal/platform/money"

// defaultJurisdiction returns the jurisdiction identifier a region starts with.
func defaultJurisdiction(region string) (string, bool) {
	switch region {
	case "BR":
		return "br", true
	}

	return "", false
}

// defaultBenchmark returns the daily index a region compares returns with, or "" (amendment
// A208 R2).
func defaultBenchmark(region string) string {
	switch region {
	case "BR":
		return "cdi"
	}

	return ""
}

// indexYearBasis returns the rate days of a year on which a daily index is quoted, or 0 when
// unknown (amendment A208 R9): the cdi is quoted on 252 business days.
func indexYearBasis(index string) int {
	switch index {
	case "cdi":
		return 252
	}

	return 0
}

// defaultInflation returns the monthly inflation index a region deflates returns with, or ""
// (amendment A208 R16).
func defaultInflation(region string) string {
	switch region {
	case "BR":
		return "ipca"
	}

	return ""
}

// indexCurrency returns the currency an index belongs to, or "" when unknown (amendment A208
// R15).
func indexCurrency(index string) money.Currency {
	switch index {
	case "cdi", "ipca":
		return "BRL"
	}

	return ""
}
