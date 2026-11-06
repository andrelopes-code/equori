package domain

import (
	"errors"
	"slices"
	"testing"
)

func TestMaskCell(t *testing.T) {
	t.Parallel()

	tests := []struct{ in, want string }{
		{"03/11/2026", "99/99/9999"},
		{"-1.234,56", "-9.999,99"},
		{"PIX JOÃO SILVA", "AAA AAAA AAAAA"},
		{"100,00 D", "999,99 D"},
		{"CR", "CR"},
		{"CPF 123.456.789-00", "AAA 999.999.999-99"},
		{"R$ 10,00", "R$ 99,99"},
		{"", ""},
	}
	for _, tt := range tests {
		if got := MaskCell(tt.in); got != tt.want {
			t.Errorf("MaskCell(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestMaskSample(t *testing.T) {
	t.Parallel()

	got := MaskSample(ColumnSample{Header: []string{"Data", "Valor 2026"}, Rows: [][]string{{"03/11/2026", "PIX JOÃO"}}})

	if !slices.Equal(got.Header, []string{"Data", "AAAAA 9999"}) {
		t.Errorf("header = %q", got.Header)
	}

	if len(got.Rows) != 1 || !slices.Equal(got.Rows[0], []string{"99/99/9999", "AAA AAAA"}) {
		t.Errorf("rows = %q", got.Rows)
	}
}

func TestNewColumnSuggestion(t *testing.T) {
	t.Parallel()

	header := []string{"Data", "Hist", "Valor", "Saldo", "Tipo"}
	tests := []struct {
		name   string
		header []string
		width  int
		in     ColumnPositions
		want   ColumnSuggestion
		usable bool
	}{
		{"amount", header, 5, ColumnPositions{Date: 1, Description: 2, Amount: 3},
			ColumnSuggestion{Date: "Data", Description: "Hist", Amount: "Valor"}, true},
		{"debit and credit", header, 5, ColumnPositions{Date: 1, Description: 2, Debit: 3, Credit: 4},
			ColumnSuggestion{Date: "Data", Description: "Hist", Debit: "Valor", Credit: "Saldo"}, true},
		{"sign", header, 5, ColumnPositions{Date: 1, Description: 2, Amount: 3, Sign: 5},
			ColumnSuggestion{Date: "Data", Description: "Hist", Amount: "Valor", Sign: "Tipo"}, true},
		{"no header", nil, 3, ColumnPositions{Date: 1, Description: 2, Amount: 3},
			ColumnSuggestion{Date: "1", Description: "2", Amount: "3"}, true},
		{"no date", header, 5, ColumnPositions{Description: 2, Amount: 3}, ColumnSuggestion{}, false},
		{"no description", header, 5, ColumnPositions{Date: 1, Amount: 3}, ColumnSuggestion{}, false},
		{"no amount", header, 5, ColumnPositions{Date: 1, Description: 2}, ColumnSuggestion{}, false},
		{"debit without credit", header, 5, ColumnPositions{Date: 1, Description: 2, Debit: 3}, ColumnSuggestion{}, false},
		{"amount with debit and credit", header, 5,
			ColumnPositions{Date: 1, Description: 2, Amount: 3, Debit: 4, Credit: 5}, ColumnSuggestion{}, false},
		{"sign without amount", header, 5,
			ColumnPositions{Date: 1, Description: 2, Debit: 3, Credit: 4, Sign: 5}, ColumnSuggestion{}, false},
		{"repeated position", header, 5, ColumnPositions{Date: 1, Description: 1, Amount: 3}, ColumnSuggestion{}, false},
		{"above the width", header, 5, ColumnPositions{Date: 9, Description: 2, Amount: 3}, ColumnSuggestion{}, false},
		{"negative", header, 5, ColumnPositions{Date: -1, Description: 2, Amount: 3}, ColumnSuggestion{}, false},
		{"repeated name", []string{"Data", "Valor", "valor "}, 3,
			ColumnPositions{Date: 1, Description: 3, Amount: 2}, ColumnSuggestion{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := NewColumnSuggestion(tt.in, tt.header, tt.width)
			if !tt.usable {
				if !errors.Is(err, ErrColumnSuggestionUnusable) {
					t.Fatalf("err = %v, want ErrColumnSuggestionUnusable", err)
				}

				return
			}

			if err != nil || got != tt.want {
				t.Fatalf("got %+v, %v; want %+v", got, err, tt.want)
			}
		})
	}
}
