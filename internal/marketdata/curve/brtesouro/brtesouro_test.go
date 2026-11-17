package brtesouro_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/curve"
	"github.com/andrelopes-code/equori/internal/marketdata/curve/brtesouro"
)

const header = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;" +
	"PU Compra Manha;PU Venda Manha;PU Base Manha\n"

// fixture holds an older Data Base, a zero rate, a coupon title and a Selic title.
const fixture = header +
	"Tesouro Prefixado;01/01/2030;16/11/2026;13,40;13,52;680,10;678,00;678,00\n" +
	"Tesouro Prefixado;01/01/2028;16/11/2026;13,10;13,22;870,10;869,00;869,00\n" +
	"Tesouro Prefixado;01/01/2029;13/11/2026;12,00;12,12;780,10;779,00;779,00\n" +
	"Tesouro Prefixado;01/01/2027;16/11/2026;0,00;13,00;0,00;985,00;985,00\n" +
	"Tesouro IPCA+;15/05/2029;16/11/2026;7,50;7,62;3700,10;3690,00;3690,00\n" +
	"Tesouro IPCA+ com Juros Semestrais;15/08/2030;16/11/2026;7,40;7,52;4300,10;4290,00;4290,00\n" +
	"Tesouro Selic;01/03/2029;16/11/2026;0,05;0,06;20289,60;20274,60;20274,60\n"

func TestFetch(t *testing.T) {
	t.Parallel()

	const modified = "Mon, 16 Nov 2026 12:00:00 GMT"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("If-Modified-Since") == modified {
			w.WriteHeader(http.StatusNotModified)

			return
		}

		w.Header().Set("Last-Modified", modified)
		_, _ = w.Write([]byte(fixture))
	}))
	t.Cleanup(srv.Close)

	src := brtesouro.New(srv.Client(), srv.URL)
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)

	got, err := src.Fetch(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	want := []curve.Curve{
		{
			ID:   "br_tesouro_prefixed",
			Base: base,
			Points: []curve.Point{
				{Maturity: time.Date(2028, 1, 1, 0, 0, 0, 0, time.UTC), Rate: "0.131000000000"},
				{Maturity: time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC), Rate: "0.134000000000"},
			},
		},
		{
			ID:   "br_tesouro_ipca",
			Base: base,
			Points: []curve.Point{
				{Maturity: time.Date(2029, 5, 15, 0, 0, 0, 0, time.UTC), Rate: "0.075000000000"},
			},
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("curves = %+v, want %+v", got, want)
	}

	again, err := src.Fetch(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	if again != nil {
		t.Fatalf("unchanged file returned %+v, want nil", again)
	}
}

func TestFetchMissingColumn(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(
			[]byte("Tipo Titulo;Data Vencimento;Data Base\nTesouro IPCA+;15/05/2029;16/11/2026\n"),
		)
	}))
	t.Cleanup(srv.Close)

	if _, err := brtesouro.New(srv.Client(), srv.URL).Fetch(t.Context()); err == nil {
		t.Fatal("header without Taxa Compra Manha accepted")
	}
}

func TestDescribe(t *testing.T) {
	t.Parallel()

	got := brtesouro.New(http.DefaultClient, "").Describe()
	want := []curve.Info{
		{ID: "br_tesouro_prefixed", Kind: curve.KindNominal, Index: "", Currency: "BRL"},
		{ID: "br_tesouro_ipca", Kind: curve.KindReal, Index: "ipca", Currency: "BRL"},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Describe = %+v, want %+v", got, want)
	}
}
