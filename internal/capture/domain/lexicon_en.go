package domain

import "time"

// English returns the lexicon of English.
func English() Lexicon {
	return Lexicon{
		Language: "en",
		DaysBack: map[string]int{"today": 0, "yesterday": 1},
		Weekdays: map[string]time.Weekday{
			"sunday": time.Sunday, "monday": time.Monday, "tuesday": time.Tuesday, "wednesday": time.Wednesday,
			"thursday": time.Thursday, "friday": time.Friday, "saturday": time.Saturday,
		},
		Destination: []string{"to"},
		Source:      []string{"from"},
		Methods: map[string]method{
			"credit": methodCredit, "debit": methodDebit, "cash": methodCash, "card": methodCard,
		},
	}
}
