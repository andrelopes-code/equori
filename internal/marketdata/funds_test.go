package marketdata_test

import (
	"archive/zip"
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const cvmFixture = "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST\n" +
	"CLASSES - FIF;00.017.024/0001-53;;2026-11-03;1131424.27;45.360755300000;1228659.83;0.00;0.00;1\n" +
	"CLASSES - FIF;00.017.024/0001-53;;2026-11-04;1131997.93;45.379513800000;1229167.93;0.00;0.00;1\n" +
	"CLASSES - FIF;00.017.024/0001-53;RBMFN1747320951;2026-11-05;62418018.41;99.000000000000;62393033.90;0.00;0.00;1\n" +
	"CLASSES - FIF;00.888.897/0001-31;;2026-11-03;62418018.41;74.941466393930;62393033.90;6000.00;170000.00;1\n"

// S368: cvm_funds stores the share value of the fund and skips a subclass line (MQ15).
func TestS368CVMFunds(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	w, err := zw.Create("inf_diario_fi_202611.csv")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := w.Write([]byte(cvmFixture)); err != nil {
		t.Fatal(err)
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cvm/inf_diario_fi_202611.zip" {
			http.NotFound(w, r)

			return
		}

		_, _ = w.Write(buf.Bytes())
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2026-11-09"),
		apitest.PriceFeeds([]string{"cvm_funds"}, map[string]string{"cvm_funds": srv.URL + "/cvm"}))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "00017024000153", "type": "fund", "scale": 6,
		"name": "Fundo Teste", "quote_currency": "BRL",
	}, http.StatusCreated, nil)

	h.App.Marketdata.TickFeeds(t.Context())

	got := pricesOf(t, h, "00017024000153")
	want := []priceAPI{
		{Instrument: "00017024000153", QuoteInstrument: "BRL", Date: "2026-11-03", Value: "45.3607553", Source: "cvm_funds"},
		{Instrument: "00017024000153", QuoteInstrument: "BRL", Date: "2026-11-04", Value: "45.3795138", Source: "cvm_funds"},
	}

	if len(got) != len(want) {
		t.Fatalf("prices = %+v, want %+v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("price %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	assertRows(t, historyRow(h, "cvm_funds", "00017024000153"), "2021-11-09 true ")
}

// S367: a region without a case suggests no Brazilian source (MQ21).
func TestS367SuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.As(apitest.Profile{
		Name: "germany", Locale: locale.Locale{Language: "en", Region: "DE"}, Base: "EUR",
	}))

	fs := feedsOf(t, h)
	if !fs["ecb"].Suggested || fs["cvm_funds"].Suggested || fs["tesouro_direto"].Suggested {
		t.Fatalf("suggested: ecb %v, cvm_funds %v, tesouro_direto %v",
			fs["ecb"].Suggested, fs["cvm_funds"].Suggested, fs["tesouro_direto"].Suggested)
	}
}
