package ingestion_test

import (
	"slices"
	"testing"
)

// columnPositions holds 1-based column positions, 0 for none; it is the shape of the model's answer.
type columnPositions struct {
	Date        int `json:"date"`
	Description int `json:"description"`
	Amount      int `json:"amount"`
	Debit       int `json:"debit"`
	Credit      int `json:"credit"`
	ID          int `json:"id"`
	Sign        int `json:"sign"`
}

type columnCase struct {
	Name     string          `json:"name"`
	Header   []string        `json:"header"`
	Rows     [][]string      `json:"rows"`
	Expected columnPositions `json:"expected"`
}

// columnCases are synthetic files: every name, date and amount is invented, none comes from a real statement.
var columnCases = []columnCase{
	{
		Name:   "semicolon pt-BR with Valor",
		Header: []string{"Data", "Descrição", "Valor", "Saldo"},
		Rows: [][]string{
			{"03/11/2026", "COMPRA MERCADO CENTRAL", "-45,90", "1.204,10"},
			{"04/11/2026", "PIX RECEBIDO MARIA", "300,00", "1.504,10"},
		},
		Expected: columnPositions{Date: 1, Description: 2, Amount: 3},
	},
	{
		Name:   "debit and credit columns",
		Header: []string{"Date", "Memo", "Debit", "Credit", "Balance"},
		Rows: [][]string{
			{"2026-11-03", "GROCERY STORE 42", "45.90", "", "1204.10"},
			{"2026-11-04", "PAYROLL ACME", "", "3000.00", "4204.10"},
		},
		Expected: columnPositions{Date: 1, Description: 2, Debit: 3, Credit: 4},
	},
	{
		Name:   "D/C sign column",
		Header: []string{"Data", "Histórico", "Valor", "D/C"},
		Rows: [][]string{
			{"03/11/2026", "TARIFA MENSAL", "29,90", "D"},
			{"04/11/2026", "DEPOSITO", "500,00", "C"},
		},
		Expected: columnPositions{Date: 1, Description: 2, Amount: 3, Sign: 4},
	},
	{
		Name:   "German header with balance",
		Header: []string{"Buchungstag", "Verwendungszweck", "Betrag", "Saldo"},
		Rows: [][]string{
			{"03.11.2026", "SUPERMARKT NORD", "-45,90", "1.204,10"},
			{"04.11.2026", "GEHALT", "2.500,00", "3.704,10"},
		},
		Expected: columnPositions{Date: 1, Description: 2, Amount: 3},
	},
	{
		Name: "no header",
		Rows: [][]string{
			{"03/11/2026", "COMPRA PADARIA", "-12,50"},
			{"04/11/2026", "TRANSFERENCIA RECEBIDA", "80,00"},
		},
		Expected: columnPositions{Date: 1, Description: 2, Amount: 3},
	},
}

// scoreColumnAnswers returns the share of cases whose answer equals the expected positions.
func scoreColumnAnswers(cases []columnCase, answers []columnPositions) float64 {
	var right int

	for i, c := range cases {
		if i < len(answers) && answers[i] == c.Expected {
			right++
		}
	}

	return float64(right) / float64(len(cases))
}

func TestColumnCases(t *testing.T) {
	t.Parallel()

	expected := make([]columnPositions, len(columnCases))
	for i, c := range columnCases {
		expected[i] = c.Expected
	}

	oneWrong := slices.Clone(expected)
	oneWrong[0].Amount = 4

	tests := []struct {
		name    string
		answers []columnPositions
		want    float64
	}{
		{"all right", expected, 1.0},
		{"one wrong", oneWrong, 0.8},
		{"none", nil, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := scoreColumnAnswers(columnCases, tt.answers); got != tt.want {
				t.Fatalf("score = %v, want %v", got, tt.want)
			}
		})
	}

	if len(columnCases) != 5 {
		t.Fatalf("cases = %d, want 5", len(columnCases))
	}

	for _, c := range columnCases {
		width := len(c.Rows[0])
		if c.Header != nil {
			width = len(c.Header)
		}

		for _, row := range c.Rows {
			if len(row) != width {
				t.Errorf("%s: row width %d, want %d", c.Name, len(row), width)
			}
		}
	}
}
