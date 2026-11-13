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

			if got := feed.SecurityType(tc.mic, tc.listing, tc.kind); got != tc.want {
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
