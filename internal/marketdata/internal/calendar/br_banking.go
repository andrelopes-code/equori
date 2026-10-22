package calendar

import "time"

// BRBanking returns the non-business days of Resolução CMN 4.880/2020.
func BRBanking() Calendar {
	return Calendar{
		ID:      "br_banking",
		Weekend: []time.Weekday{time.Saturday, time.Sunday},
		Rules: []Rule{
			{Name: "New Year's Day", Date: Fixed{time.January, 1}},
			{Name: "Carnival Monday", Date: EasterOffset{-48}},
			{Name: "Carnival Tuesday", Date: EasterOffset{-47}},
			{Name: "Good Friday", Date: EasterOffset{-2}},
			{Name: "Tiradentes", Date: Fixed{time.April, 21}},
			{Name: "Labour Day", Date: Fixed{time.May, 1}},
			{Name: "Corpus Christi", Date: EasterOffset{60}},
			{Name: "Independence Day", Date: Fixed{time.September, 7}},
			{Name: "Our Lady of Aparecida", Date: Fixed{time.October, 12}},
			{Name: "All Souls' Day", Date: Fixed{time.November, 2}},
			{Name: "Republic Proclamation Day", Date: Fixed{time.November, 15}},
			{Name: "Christmas Day", Date: Fixed{time.December, 25}},
			{Name: "Black Consciousness Day", Date: Fixed{time.November, 20}, From: 2024}, // Lei 14.759/2023
		},
	}
}
