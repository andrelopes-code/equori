package brcvmfii_test

import (
	"archive/zip"
	"bytes"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/fundreport"
	"github.com/andrelopes-code/equori/internal/marketdata/fundreport/brcvmfii"
)

const (
	geralHeader = "Tipo_Fundo_Classe;CNPJ_Fundo_Classe;Data_Referencia;Versao;Data_Entrega;" +
		"Nome_Fundo_Classe;Codigo_ISIN;Segmento_Atuacao;Mercado_Negociacao_Bolsa\n"

	complementoHeader = "CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Numero_Cotistas;" +
		"Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;" +
		"Percentual_Despesas_Taxa_Administracao;Percentual_Dividend_Yield_Mes;" +
		"Percentual_Amortizacao_Cotas_Mes\n"

	// The Latin-1 bytes are \xc1 (A with acute) and \xed (i with acute).
	geral = geralHeader +
		"Classe;11.728.688/0001-47;2026-10-01;1;2026-11-13;P\xc1TRIA LOG FII;BRHGLGCTF004;" +
		"Log\xedstica;S\n" +
		"Classe;11.728.688/0001-47;2026-09-01;1;2026-10-14;PATRIA LOG;BRHGLGCTF004;" +
		"Log\xedstica;S\n" +
		"Classe;11.728.688/0001-47;2026-09-01;2;2026-10-20;P\xc1TRIA LOG FII;BRHGLGCTF004;" +
		"Log\xedstica;S\n" +
		"Classe;22.222.222/0001-22;2026-10-01;1;2026-11-12;FUNDO B;BRABCDCTF001;Outros;S\n" +
		"Classe;33.333.333/0001-33;2026-10-01;1;2026-11-12;FUNDO C;BRABCDCTF019;Outros;S\n" +
		"Classe;44.444.444/0001-44;2026-10-01;1;2026-11-12;FUNDO D;0;Outros;S\n" +
		"Classe;55.555.555/0001-55;2026-10-01;1;2026-11-12;FUNDO E;BREFGHCTF002;Outros;N\n" +
		"Classe;66.666.666/0001-66;2026-10-01;1;2026-11-12;FUNDO F;BRXPTOCTF003;Shoppings;S\n"

	complemento = complementoHeader +
		"11.728.688/0001-47;2026-10-01;1;633787;7656899371.48;46398492;165.02474631029;" +
		"0.000465;0.006943;0\n" +
		"11.728.688/0001-47;2026-09-01;1;613000;7500000000;45601713;164.5;0.00044;0.007;0\n" +
		"11.728.688/0001-47;2026-09-01;2;613837;7546017797.39;45601713;165.476630173739;" +
		"0.000446;0.007052;0\n" +
		"22.222.222/0001-22;2026-10-01;1;10;1000;10;100;0;0;0\n" +
		"33.333.333/0001-33;2026-10-01;1;10;1000;10;100;0;0;0\n" +
		"44.444.444/0001-44;2026-10-01;1;10;1000;10;100;0;0;0\n" +
		"55.555.555/0001-55;2026-10-01;1;10;1000;10;100;0;0;0\n" +
		"66.666.666/0001-66;2026-10-01;1;10;;;;abc;;\n"

	modified = "Mon, 16 Nov 2026 12:00:00 GMT"
)

func TestFetch(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)
	srv := newServer(t, map[string][]byte{
		"/inf_mensal_fii_2026.zip": fundReportZip(t, "2026", geral, complemento),
	})

	src := brcvmfii.New(srv.client(), srv.URL)

	got, err := src.Fetch(t.Context(), today, nil)
	if err != nil {
		t.Fatal(err)
	}

	if got.Currency != "BRL" {
		t.Fatalf("currency = %q, want BRL", got.Currency)
	}

	if want := wantReports(); !reflect.DeepEqual(got.Reports, want) {
		t.Fatalf("reports = %+v, want %+v", got.Reports, want)
	}

	t.Run("unchanged file", func(t *testing.T) {
		again, err := src.Fetch(t.Context(), today, nil)
		if err != nil {
			t.Fatal(err)
		}

		if len(again.Reports) != 0 {
			t.Fatalf("unchanged file returned %+v, want none", again.Reports)
		}
	})

	t.Run("year complete in have", func(t *testing.T) {
		srv.reset()

		var have []time.Time
		for m := time.January; m <= time.December; m++ {
			have = append(have, time.Date(2025, m, 1, 0, 0, 0, 0, time.UTC))
		}

		if _, err := src.Fetch(t.Context(), today, have); err != nil {
			t.Fatal(err)
		}

		if slices.Contains(srv.paths(), "/inf_mensal_fii_2025.zip") {
			t.Fatalf("requested a complete year: %v", srv.paths())
		}

		if !slices.Contains(srv.paths(), "/inf_mensal_fii_2026.zip") {
			t.Fatalf("did not request the open year: %v", srv.paths())
		}
	})
}

// The register writes some fractions in scientific notation (00GE11, 2026: "8.3E-05"); the
// report carries them as plain decimals, which a numeric column accepts.
func TestFetchScientificNotation(t *testing.T) {
	t.Parallel()

	geralRows := geralHeader +
		"Classe;11.728.688/0001-47;2026-10-01;1;2026-11-13;FUNDO;BRHGLGCTF004;Log\xedstica;S\n"
	complementoRows := complementoHeader +
		"11.728.688/0001-47;2026-10-01;1;10;1000;10;1.5E+2;8.3E-05;6.943e-3;0E-7\n"
	srv := newServer(t, map[string][]byte{
		"/inf_mensal_fii_2026.zip": fundReportZip(t, "2026", geralRows, complementoRows),
	})
	today := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)

	got, err := brcvmfii.New(srv.client(), srv.URL).Fetch(t.Context(), today, nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(got.Reports) != 1 {
		t.Fatalf("reports = %+v, want one", got.Reports)
	}

	r := got.Reports[0]
	for name, tc := range map[string]struct {
		got  *string
		want string
	}{
		"unit book value":    {r.UnitBookValue, "150"},
		"admin fee":          {r.AdminFee, "0.000083"},
		"month yield":        {r.MonthYield, "0.006943"},
		"month amortization": {r.MonthAmortization, "0"},
	} {
		if tc.got == nil || *tc.got != tc.want {
			t.Errorf("%s = %v, want %s", name, tc.got, tc.want)
		}
	}
}

func TestFetchMalformedFile(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		archive []byte
		want    string
	}{
		"geral without Codigo_ISIN": {
			archive: fundReportZip(
				t,
				"2026",
				strings.Replace(geral, "Codigo_ISIN", "Outra", 1),
				complemento,
			),
			want: "Codigo_ISIN",
		},
		"archive without complemento": {
			archive: zipOf(t, map[string]string{"inf_mensal_fii_geral_2026.csv": geral}),
			want:    "inf_mensal_fii_complemento_2026.csv",
		},
	} {
		t.Run(name, func(t *testing.T) {
			srv := newServer(t, map[string][]byte{"/inf_mensal_fii_2026.zip": tc.archive})
			today := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)

			_, err := brcvmfii.New(srv.client(), srv.URL).Fetch(t.Context(), today, nil)
			if err == nil {
				t.Fatal("accepted")
			}

			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not name %q", err, tc.want)
			}
		})
	}
}

func wantReports() []fundreport.Report {
	date := func(y int, m time.Month, d int) time.Time {
		return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	}
	ptr := func(s string) *string { return &s }
	num := func(n int64) *int64 { return &n }
	delivered := func(d time.Time) *time.Time { return &d }

	return []fundreport.Report{
		{
			Exchange:          "BVMF",
			Code:              "HGLG11",
			Period:            date(2026, time.September, 1),
			Identifier:        "11728688000147",
			Name:              "PÁTRIA LOG FII",
			Segment:           "Logística",
			Delivered:         delivered(date(2026, time.October, 20)),
			NetAssets:         num(754601779739),
			Holders:           num(613837),
			Units:             ptr("45601713"),
			UnitBookValue:     ptr("165.476630173739"),
			AdminFee:          ptr("0.000446"),
			MonthYield:        ptr("0.007052"),
			MonthAmortization: ptr("0"),
		},
		shared("22222222000122", "FUNDO B"),
		shared("33333333000133", "FUNDO C"),
		{
			Exchange:          "BVMF",
			Code:              "HGLG11",
			Period:            date(2026, time.October, 1),
			Identifier:        "11728688000147",
			Name:              "PÁTRIA LOG FII",
			Segment:           "Logística",
			Delivered:         delivered(date(2026, time.November, 13)),
			NetAssets:         num(765689937148),
			Holders:           num(633787),
			Units:             ptr("46398492"),
			UnitBookValue:     ptr("165.02474631029"),
			AdminFee:          ptr("0.000465"),
			MonthYield:        ptr("0.006943"),
			MonthAmortization: ptr("0"),
		},
		{
			Exchange:   "BVMF",
			Code:       "XPTO11",
			Period:     date(2026, time.October, 1),
			Identifier: "66666666000166",
			Name:       "FUNDO F",
			Segment:    "Shoppings",
			Delivered:  delivered(date(2026, time.November, 12)),
			Holders:    num(10),
		},
	}
}

// shared is a fund of 2026-10-01 whose code ABCD11 another fund of the file also gives (FR4).
func shared(identifier, name string) fundreport.Report {
	delivered := time.Date(2026, time.November, 12, 0, 0, 0, 0, time.UTC)
	text := func(s string) *string { return &s }
	num := func(n int64) *int64 { return &n }

	return fundreport.Report{
		Exchange:          "BVMF",
		Code:              "ABCD11",
		Shared:            true,
		Period:            time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC),
		Identifier:        identifier,
		Name:              name,
		Segment:           "Outros",
		Delivered:         &delivered,
		NetAssets:         num(100000),
		Holders:           num(10),
		Units:             text("10"),
		UnitBookValue:     text("100"),
		AdminFee:          text("0"),
		MonthYield:        text("0"),
		MonthAmortization: text("0"),
	}
}

// fundReportZip writes the two members of a yearly file.
func fundReportZip(t *testing.T, year, geralCSV, complementoCSV string) []byte {
	t.Helper()

	return zipOf(t, map[string]string{
		"inf_mensal_fii_geral_" + year + ".csv":       geralCSV,
		"inf_mensal_fii_complemento_" + year + ".csv": complementoCSV,
	})
}

func zipOf(t *testing.T, members map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	for name, content := range members {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return buf.Bytes()
}

// server answers each path of files, 404 otherwise, and 304 to a known If-Modified-Since.
type server struct {
	*httptest.Server

	mu   sync.Mutex
	seen []string
}

func newServer(t *testing.T, files map[string][]byte) *server {
	t.Helper()

	s := &server{}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.seen = append(s.seen, r.URL.Path)
		s.mu.Unlock()

		body, ok := files[r.URL.Path]
		if !ok {
			http.NotFound(w, r)

			return
		}

		if r.Header.Get("If-Modified-Since") == modified {
			w.WriteHeader(http.StatusNotModified)

			return
		}

		w.Header().Set("Last-Modified", modified)
		_, _ = w.Write(body)
	}))
	t.Cleanup(s.Close)

	return s
}

func (s *server) client() *http.Client { return s.Client() }

func (s *server) paths() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return append([]string(nil), s.seen...)
}

func (s *server) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.seen = nil
}
