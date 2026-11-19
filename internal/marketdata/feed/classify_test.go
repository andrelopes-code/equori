package feed_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

func TestSecurityType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, mic, listing, kind, want string
	}{
		{
			"etf by class of index", "BVMF",
			"ISHARES IBOVESPA CLASSE DE ÍNDICE - RESPONSABILIDADE LIMITADA", "stock", "etf",
		},
		{
			"etf by fund of index",
			"BVMF",
			"HASHDEX NASDAQ CME CRYPTO INDEX FUNDO DE ÍNDICE - RESPONSABILIDADE LIMITADA",
			"stock",
			"etf",
		},
		{
			"etf by index without accent", "BVMF",
			"TREND ETF LBMA OURO CLASSE DE INDICE INVESTIMENTO NO EXTERIOR", "stock", "etf",
		},
		{
			"reit by real estate fund", "BVMF",
			"Kinea Renda Imobiliária Fundo de Investimento Imobiliário", "stock", "reit",
		},
		{
			"reit with a typo in the name", "BVMF",
			"Maxi Renda Fundo De Investimento Imobiliaro - FII", "stock", "reit",
		},
		{"company of real estate stays a stock", "BVMF",
			"MULTIPLAN EMPREENDIMENTOS IMOBILIARIOS S.A.", "stock", "stock"},
		{
			"plain company stays a stock",
			"BVMF",
			"Petróleo Brasileiro S.A. - Petrobras",
			"stock",
			"stock",
		},
		{"a type the source states is kept", "BVMF", "Maxi Renda Fundo Imobiliário", "etf", "etf"},
		{"another exchange is not changed", "XNYS", "Some Fundo De Índice", "stock", "stock"},
		{"a listing without a name", "BVMF", "", "stock", "stock"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := feed.SecurityType(tc.mic, "", tc.listing, tc.kind); got != tc.want {
				t.Errorf(
					"SecurityType(%q, %q, %q) = %q, want %q",
					tc.mic,
					tc.listing,
					tc.kind,
					got,
					tc.want,
				)
			}
		})
	}
}

// A BDR of the B3 is named after its issuer abroad ("Apple Inc."): its code says what it is, a
// number of 31 to 35 for a receipt of shares and 39 for a receipt of an ETF.
func TestSecurityTypeOfAReceipt(t *testing.T) {
	t.Parallel()

	tests := []struct{ mic, code, kind, want string }{
		{"BVMF", "AAPL34", "stock", "depositary_receipt"},
		{"BVMF", "ROXO34", "stock", "depositary_receipt"},
		{"BVMF", "BIVB39", "stock", "depositary_receipt"},
		{"BVMF", "ITUB31", "stock", "depositary_receipt"},
		{"BVMF", "PETR3", "stock", "stock"},
		{"BVMF", "TAEE11", "stock", "stock"},
		{"BVMF", "AAPL34", "etf", "etf"},
		{"XNAS", "AAPL34", "stock", "stock"},
	}
	for _, tc := range tests {
		if got := feed.SecurityType(tc.mic, tc.code, "Apple Inc.", tc.kind); got != tc.want {
			t.Errorf(
				"SecurityType(%q, %q, %q) = %q, want %q",
				tc.mic,
				tc.code,
				tc.kind,
				got,
				tc.want,
			)
		}
	}
}
