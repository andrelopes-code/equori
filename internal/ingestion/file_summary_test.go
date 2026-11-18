package ingestion_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ingestion"
)

// Assistant parity design F4: the model reads of an ofx file its line count, period and currency,
// and of a csv file the header and up to 12 lines masked as a column suggestion masks them.
func TestFileSummary(t *testing.T) {
	t.Parallel()

	ofx := apitest.OFX(
		"",
		apitest.OFXLine{Date: "20261003", Amount: "-12.50", FITID: "1", Name: "Padaria"},
		apitest.OFXLine{Date: "20261010", Amount: "100.00", FITID: "2", Name: "Salario"},
	)

	if got, want := ingestion.FileSummary("ofx", ofx),
		"OFX statement: 2 lines from 2026-10-01 to 2026-10-31, currency BRL."; got != want {
		t.Errorf("ofx summary = %q, want %q", got, want)
	}

	var csv strings.Builder
	csv.WriteString("Data;Valor;Histórico\n")

	for range 14 {
		csv.WriteString("01/11/2026;-10,00;Café Bom\n")
	}

	header := "CSV file, delimiter \";\", header and 12 of 14 lines, digits as 9 and letters as A:"
	want := header + "\nData;Valor;Histórico" + strings.Repeat("\n99/99/9999;-99,99;AAAA AAA", 12)

	if got := ingestion.FileSummary("csv", []byte(csv.String())); got != want {
		t.Errorf("csv summary = %q, want %q", got, want)
	}

	if got := ingestion.FileSummary("ofx", []byte("OFXHEADER:100\n<OFX>broken")); got !=
		"OFX statement that could not be read." {
		t.Errorf("broken ofx summary = %q", got)
	}

	if got := ingestion.FileSummary("pdf", []byte("%PDF-1.7")); got != "" {
		t.Errorf("pdf summary = %q, want none", got)
	}
}
