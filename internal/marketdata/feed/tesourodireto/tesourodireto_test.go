package tesourodireto_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/tesourodireto"
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
		{
			"NTNBP",
			feed.Instrument{Code: "NTNBP.20350515", Type: "fixed_income", QuoteCurrency: "BRL"},
			true,
		},
		{
			"LFT",
			feed.Instrument{Code: "LFT.20270301", Type: "fixed_income", QuoteCurrency: "BRL"},
			true,
		},
		{
			"exchange",
			feed.Instrument{
				Code:          "NTNBP.20350515",
				Type:          "fixed_income",
				Exchange:      "BVMF",
				QuoteCurrency: "BRL",
			},
			false,
		},
		{
			"quote",
			feed.Instrument{Code: "NTNBP.20350515", Type: "fixed_income", QuoteCurrency: "USD"},
			false,
		},
		{
			"short date",
			feed.Instrument{Code: "NTNBP.2035", Type: "fixed_income", QuoteCurrency: "BRL"},
			false,
		},
		{
			"prefix",
			feed.Instrument{Code: "CDB.20350515", Type: "fixed_income", QuoteCurrency: "BRL"},
			false,
		},
		{
			"type",
			feed.Instrument{Code: "NTNBP.20350515", Type: "fund", QuoteCurrency: "BRL"},
			false,
		},
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

	got, err := tesourodireto.New(srv.Client(), srv.URL+"/td.csv").
		Fetch(t.Context(), codes, from, to)
	if err != nil {
		t.Fatal(err)
	}

	var lines []string
	for _, q := range got {
		lines = append(
			lines,
			fmt.Sprintf(
				"%s %s %s %s",
				q.Instrument,
				q.Quote,
				q.Date.Format(time.DateOnly),
				q.Value.String(),
			),
		)
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

	got, err = tesourodireto.New(srv.Client(), srv.URL+"/missing.csv").
		Fetch(t.Context(), codes, from, to)
	if err != nil || len(got) != 0 {
		t.Fatalf("404: quotes = %v, err = %v", got, err)
	}
}

// titlesFixture holds the titles of two base dates; only the latest one is listed.
const titlesFixture = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n" +
	"Tesouro IPCA+;15/08/2030;05/11/2026;7,90;8,02;3000,00;2990,00;2990,00\n" +
	"Tesouro IPCA+;15/05/2035;06/11/2026;7,87;7,99;2515,93;2491,12;2491,12\n" +
	"Tesouro Selic;01/03/2027;06/11/2026;0,02;0,03;20251,05;20240,05;20240,05\n" +
	"Tesouro Outro;15/05/2035;06/11/2026;7,00;7,10;100,00;99,00;99,00\n"

func TestSearch(t *testing.T) {
	t.Parallel()

	var requests atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)

		_, _ = w.Write([]byte(titlesFixture))
	}))
	t.Cleanup(srv.Close)

	t.Run("downloads the file once", func(t *testing.T) {
		requests.Store(0)

		src := tesourodireto.New(srv.Client(), srv.URL+"/td.csv")

		got, err := src.Search(t.Context(), "ipca", 20)
		if err != nil {
			t.Fatal(err)
		}

		want := []feed.Listing{
			{
				Code:          "NTNBP.20350515",
				Name:          "Tesouro IPCA+ 2035",
				Type:          "fixed_income",
				QuoteCurrency: "BRL",
			},
		}
		if !slices.Equal(got, want) {
			t.Fatalf("ipca = %v, want %v", got, want)
		}

		got, err = src.Search(t.Context(), "tesouro", 20)
		if err != nil {
			t.Fatal(err)
		}

		if len(got) != 2 || got[0].Code != "LFT.20270301" || got[0].Name != "Tesouro Selic 2027" ||
			got[1].Code != "NTNBP.20350515" {
			t.Fatalf("tesouro = %v", got)
		}

		if n := requests.Load(); n != 1 {
			t.Fatalf("requests = %d, want 1", n)
		}
	})

	t.Run("lists the file a fetch read", func(t *testing.T) {
		requests.Store(0)

		src := tesourodireto.New(srv.Client(), srv.URL+"/td.csv")

		quotes, err := src.Fetch(
			t.Context(), []money.Currency{"NTNBP.20350515"}, day("2026-11-01"), day("2026-11-09"),
		)
		if err != nil || len(quotes) != 1 {
			t.Fatalf("quotes = %v, err = %v", quotes, err)
		}

		got, err := src.Search(t.Context(), "selic", 20)
		if err != nil || len(got) != 1 || got[0].Code != "LFT.20270301" {
			t.Fatalf("selic = %v, err = %v", got, err)
		}

		if n := requests.Load(); n != 1 {
			t.Fatalf("requests = %d, want 1", n)
		}
	})

	// The file takes longer to download than the bound of a catalog search (4 s on 2026-11-15).
	t.Run("a search past its bound fills the list for the next one", func(t *testing.T) {
		var slowRequests atomic.Int32

		started, release := make(chan struct{}), make(chan struct{})

		slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			if slowRequests.Add(1) == 1 {
				close(started)
			}

			<-release

			_, _ = w.Write([]byte(titlesFixture))
		}))
		t.Cleanup(slow.Close)

		src := tesourodireto.New(slow.Client(), slow.URL+"/td.csv")
		ctx, cancel := context.WithCancel(t.Context())
		errs := make(chan error, 1)

		go func() {
			_, err := src.Search(ctx, "selic", 20)
			errs <- err
		}()

		<-started
		cancel()

		if err := <-errs; err == nil {
			t.Fatal("first search: err = nil, want the error of its bound")
		}

		close(release)

		got, err := src.Search(t.Context(), "selic", 20)
		if err != nil || len(got) != 1 || got[0].Code != "LFT.20270301" {
			t.Fatalf("selic = %v, err = %v", got, err)
		}

		if n := slowRequests.Load(); n != 1 {
			t.Fatalf("requests = %d, want 1", n)
		}
	})
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}
