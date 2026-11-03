package calendar

import "time"

// BRBanking returns the non-business days of Resolução CMN 4.880/2020.
func BRBanking() Calendar {
	return Calendar{
		ID:      "br_banking",
		Weekend: []time.Weekday{time.Saturday, time.Sunday},
		Rules: []Rule{
			{Code: "new_years_day", Name: "New Year's Day", Date: Fixed{time.January, 1}},
			{Code: "carnival_monday", Name: "Carnival Monday", Date: EasterOffset{-48}},
			{Code: "carnival_tuesday", Name: "Carnival Tuesday", Date: EasterOffset{-47}},
			{Code: "good_friday", Name: "Good Friday", Date: EasterOffset{-2}},
			{Code: "tiradentes", Name: "Tiradentes", Date: Fixed{time.April, 21}},
			{Code: "labour_day", Name: "Labour Day", Date: Fixed{time.May, 1}},
			{Code: "corpus_christi", Name: "Corpus Christi", Date: EasterOffset{60}},
			{Code: "independence_day", Name: "Independence Day", Date: Fixed{time.September, 7}},
			{Code: "our_lady_of_aparecida", Name: "Our Lady of Aparecida", Date: Fixed{time.October, 12}},
			{Code: "all_souls_day", Name: "All Souls' Day", Date: Fixed{time.November, 2}},
			{Code: "republic_proclamation_day", Name: "Republic Proclamation Day", Date: Fixed{time.November, 15}},
			{Code: "christmas_day", Name: "Christmas Day", Date: Fixed{time.December, 25}},
			{Code: "black_consciousness_day", Name: "Black Consciousness Day", Date: Fixed{time.November, 20}, From: 2024}, // Lei 14.759/2023
		},
	}
}
