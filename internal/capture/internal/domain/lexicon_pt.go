package domain

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Portuguese returns the lexicon of Portuguese.
func Portuguese() Lexicon {
	return Lexicon{
		Language: "pt",
		DaysBack: map[string]int{"hoje": 0, "ontem": 1, "anteontem": 2},
		Weekdays: map[string]time.Weekday{
			"domingo": time.Sunday, "segunda": time.Monday, "segunda-feira": time.Monday, "terca": time.Tuesday,
			"terca-feira": time.Tuesday, "quarta": time.Wednesday, "quarta-feira": time.Wednesday, "quinta": time.Thursday,
			"quinta-feira": time.Thursday, "sexta": time.Friday, "sexta-feira": time.Friday, "sabado": time.Saturday,
		},
		Multipliers:      map[string]int64{"k": 1000, "mil": 1000},
		CurrencyWords:    map[string]money.Currency{"reais": "BRL", "real": "BRL"},
		CurrencySymbols:  map[string]money.Currency{"r$": "BRL"},
		CountWords:       []string{"x", "vezes", "parcelas"},
		InstallmentLeads: []string{"parcelado", "parcelada", "em"},
		LumpSum:          [][]string{{"a", "vista"}},
		Of:               []string{"de"},
		Destination:      []string{"para", "pra", "pro", "p/", "->", "→"},
		Source:           []string{"de", "do", "da"},
		Methods: map[string]method{
			"credito": methodCredit, "debito": methodDebit, "pix": methodDebit, "ted": methodDebit,
			"dinheiro": methodCash, "especie": methodCash, "cartao": methodCard,
		},
	}
}
