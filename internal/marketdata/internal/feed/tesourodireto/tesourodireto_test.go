package tesourodireto_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/tesourodireto"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// fixture holds a zero price, a title type outside the map and a Latin-1 byte (\xed).
const fixture = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n" +
	"Tesouro IPCA+;15/05/2035;03/11/2026;7,94;8,06;2499,00;0,00;2499,00\n" +
	"Tesouro IPCA+;15/05/2035;04/11/2026;7,94;8,06;2499,97;2475,64;2475,64\n" +
	"Tesouro IPCA+;15/05/2035;05/11/2026;7,94;8,06;2500,90;2476,57;2476,57\n" +
	"Tesouro IPCA+;15/05/2035;06/11/2026;7,87;7,99;2515,93;2491,12;2491,12\n" +
	"Tesouro Selic;01/03/2027;06/11/2026;0,02;0,03;20251,05;20240,05;20240,05\n" +
	"Tesouro Novo T\xedtulo;15/05/2035;06/11/2026;7,00;7,10;100,00;99,00;99,00\n"

func TestCodes(t *testing.T) {
	t.Parallel()

	src := tesourodireto.New(http.DefaultClient, "")

	tests := []struct {
		name string
		in   feed.Instrument
		want bool
	}{
		{"NTNBP", feed.Instrument{Code: "NTNBP.20350515", Type: "fixed_income", QuoteCurrency: "BRL"}, true},
		{"LFT", feed.Instrument{Code: "LFT.20270301", Type: "fixed_income", QuoteCurrency: "BRL"}, true},
		{"exchange", feed.Instrument{Code: "NTNBP.20350515", Type: "fixed_income", Exchange: "BVMF", QuoteCurrency: "BRL"}, false},
		{"quote", feed.Instrument{Code: "NTNBP.20350515", Type: "fixed_income", QuoteCurrency: "USD"}, false},
		{"short date", feed.Instrument{Code: "NTNBP.2035", Type: "fixed_income", QuoteCurrency: "BRL"}, false},
		{"prefix", feed.Instrument{Code: "CDB.20350515", Type: "fixed_income", QuoteCurrency: "BRL"}, false},
		{"type", feed.Instrument{Code: "NTNBP.20350515", Type: "fund", QuoteCurrency: "BRL"}, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := src.Codes([]feed.Instrument{tc.in})
			if (len(got) == 1) != tc.want {
				t.Fatalf("codes = %v, want quoted %v", got, tc.want)
			}
		})
	}
}

func TestFetch(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/missing.csv" {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write([]byte(fixture))
	}))
	t.Cleanup(srv.Close)

	codes := []money.Currency{"NTNBP.20350515", "LFT.20270301"}
	from, to := day("2026-11-01"), day("2026-11-09")

	got, err := tesourodireto.New(srv.Client(), srv.URL+"/td.csv").Fetch(t.Context(), codes, from, to)
	if err != nil {
		t.Fatal(err)
	}

	var lines []string
	for _, q := range got {
		lines = append(lines, fmt.Sprintf("%s %s %s %s", q.Instrument, q.Quote, q.Date.Format(time.DateOnly), q.Value.String()))
	}

	slices.Sort(lines)

	want := []string{
		"LFT.20270301 BRL 2026-11-06 20240.05",
		"NTNBP.20350515 BRL 2026-11-04 2475.64",
		"NTNBP.20350515 BRL 2026-11-05 2476.57",
		"NTNBP.20350515 BRL 2026-11-06 2491.12",
	}
	if !slices.Equal(lines, want) {
		t.Fatalf("quotes = %v, want %v", lines, want)
	}

	got, err = tesourodireto.New(srv.Client(), srv.URL+"/missing.csv").Fetch(t.Context(), codes, from, to)
	if err != nil || len(got) != 0 {
		t.Fatalf("404: quotes = %v, err = %v", got, err)
	}
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}
