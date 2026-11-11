package main

import "time"

// Payroll of Tarsus Tecnologia. Amounts are in cents.
const (
	healthPlanDiscount = 31240
	inss2024           = 87724 // maximum monthly contribution of the year
	inss2025           = 95162
	inss2026           = 98809
)

func gross(month time.Time) int64 {
	return step(month, 1490000, map[string]int64{"2026-01": 1580000})
}

func inssOf(month time.Time) int64 {
	switch month.Year() {
	case 2024:
		return inss2024
	case 2025:
		return inss2025
	default:
		return inss2026
	}
}

// irrfOf applies the 27.5 % bracket with its deduction; every salary of the persona falls in it.
func irrfOf(base int64, month time.Time) int64 {
	deduction := int64(89600)
	if ym(month) >= "2025-05" {
		deduction = 90873
	}

	return base*275/1000 - deduction
}
