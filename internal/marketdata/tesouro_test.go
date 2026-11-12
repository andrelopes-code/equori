package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const tesouroFixture = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n" +
	"Tesouro IPCA+;15/05/2035;03/11/2026;7,94;8,06;2499,00;0,00;2499,00\n" +
	"Tesouro IPCA+;15/05/2035;04/11/2026;7,94;8,06;2499,97;2475,64;2475,64\n" +
	"Tesouro IPCA+;15/05/2035;05/11/2026;7,94;8,06;2500,90;2476,57;2476,57\n" +
	"Tesouro IPCA+;15/05/2035;06/11/2026;7,87;7,99;2515,93;2491,12;2491,12\n" +
	"Tesouro Selic;01/03/2027;06/11/2026;0,02;0,03;20251,05;20240,05;20240,05\n" +
	"Tesouro Novo T\xedtulo;15/05/2035;06/11/2026;7,00;7,10;100,00;99,00;99,00\n"

// S369: tesouro_direto stores PU Venda Manha and skips a title type outside the map (MQ16).
func TestS369TesouroDireto(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(tesouroFixture))
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(
			[]string{"tesouro_direto"},
			map[string]string{"tesouro_direto": srv.URL + "/td.csv"},
		),
	)
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "NTNBP.20350515", "type": "fixed_income", "scale": 2,
		"name": "Tesouro IPCA+ 2035", "quote_currency": "BRL",
	}, http.StatusCreated, nil)

	h.App.Marketdata.TickFeeds(t.Context())

	got := pricesOf(t, h, "NTNBP.20350515")
	want := []priceAPI{
		{
			Instrument:      "NTNBP.20350515",
			QuoteInstrument: "BRL",
			Date:            "2026-11-04",
			Value:           "2475.64",
			Source:          "tesouro_direto",
		},
		{
			Instrument:      "NTNBP.20350515",
			QuoteInstrument: "BRL",
			Date:            "2026-11-05",
			Value:           "2476.57",
			Source:          "tesouro_direto",
		},
		{
			Instrument:      "NTNBP.20350515",
			QuoteInstrument: "BRL",
			Date:            "2026-11-06",
			Value:           "2491.12",
			Source:          "tesouro_direto",
		},
	}

	if len(got) != len(want) {
		t.Fatalf("prices = %+v, want %+v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("price %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	if e := feedsOf(t, h)["tesouro_direto"].Error; e != nil {
		t.Fatalf("tesouro_direto error = %v", *e)
	}
}
