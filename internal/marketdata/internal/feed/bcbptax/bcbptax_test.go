package bcbptax_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/bcbptax"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const ptaxUSD = `{"@odata.context":"x","value":[
{"paridadeCompra":1.00000,"paridadeVenda":1.00000,"cotacaoCompra":5.48200,"cotacaoVenda":5.48260,"dataHoraCotacao":"2026-10-29 10:07:12.847","tipoBoletim":"Abertura"},
{"paridadeCompra":1.00000,"paridadeVenda":1.00000,"cotacaoCompra":5.49440,"cotacaoVenda":5.49500,"dataHoraCotacao":"2026-10-29 13:09:28.211","tipoBoletim":"Fechamento"},
{"paridadeCompra":1.00000,"paridadeVenda":1.00000,"cotacaoCompra":5.50000,"cotacaoVenda":5.50060,"dataHoraCotacao":"2026-10-30 11:06:12.263","tipoBoletim":"Intermediário"},
{"paridadeCompra":1.00000,"paridadeVenda":1.00000,"cotacaoCompra":5.49940,"cotacaoVenda":5.5,"dataHoraCotacao":"2026-10-30 13:10:01.000","tipoBoletim":"Fechamento"}
]}`

func TestPTAX(t *testing.T) {
	t.Parallel()
	var rawURL string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawURL = r.URL.RequestURI()
		if r.URL.Query().Get("@moeda") == "'SEK'" {
			_, _ = w.Write([]byte(`{"value":[]}`))
			return
		}
		if r.URL.Query().Get("@moeda") == "'EUR'" {
			http.Error(w, "busy", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte(ptaxUSD))
	}))
	t.Cleanup(srv.Close)
	src := bcbptax.New(srv.Client(), srv.URL)

	got, err := src.Fetch(t.Context(), []money.Currency{"USD"}, day("2026-10-29"), day("2026-10-30"))
	if err != nil {
		t.Fatal(err)
	}
	want := "/ExchangeRatePeriod(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial='10-29-2026'&@dataFinalCotacao='10-30-2026'&$format=json"
	if rawURL != want {
		t.Fatalf("request = %s", rawURL)
	}
	if len(got) != 2 || got[0].Instrument != "USD" || got[0].Quote != "BRL" || !got[0].Date.Equal(day("2026-10-29")) || got[0].Value.String() != "5.49500" ||
		!got[1].Date.Equal(day("2026-10-30")) || got[1].Value.String() != "5.5" {
		t.Fatalf("quotes = %+v", got)
	}

	if got, err := src.Fetch(t.Context(), []money.Currency{"SEK"}, day("2026-10-29"), day("2026-10-30")); err != nil || len(got) != 0 {
		t.Fatalf("empty answer = %+v, %v", got, err)
	}
	if _, err := src.Fetch(t.Context(), []money.Currency{"EUR"}, day("2026-10-29"), day("2026-10-30")); err == nil {
		t.Fatal("a 503 answer returned no error")
	}
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestCodes(t *testing.T) {
	t.Parallel()
	ins := []feed.Instrument{
		{Code: "BRL", Type: "currency"}, {Code: "USD", Type: "currency"}, {Code: "KWD", Type: "currency"},
		{Code: "EUR", Type: "currency"}, {Code: "MXRF11", Type: "reit", Exchange: "B3", QuoteCurrency: "BRL"},
	}
	got := bcbptax.New(nil, "").Codes(ins)
	if len(got) != 2 || got[0] != "USD" || got[1] != "EUR" {
		t.Fatalf("codes = %v", got)
	}
}
