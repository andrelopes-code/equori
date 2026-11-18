package brcvmcia_test

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

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/companyreport/brcvmcia"
)

const (
	weg   = "84.429.695/0001-11"
	ind   = "11.111.111/0001-11"
	banco = "22.222.222/0001-22"

	mil    = "MIL"
	unit   = "UNIDADE"
	last   = "ÚLTIMO"
	before = "PENÚLTIMO"

	balanceHeader = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;" +
		"ORDEM_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA"
	flowHeader = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;" +
		"ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA"
	generalHeader = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC"
	capitalHeader = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;QT_ACAO_ORDIN_CAP_INTEGR;" +
		"QT_ACAO_PREF_CAP_INTEGR;QT_ACAO_TOTAL_CAP_INTEGR;QT_ACAO_ORDIN_TESOURO;" +
		"QT_ACAO_PREF_TESOURO;QT_ACAO_TOTAL_TESOURO"
	listingHeader = "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;" +
		"Valor_Mobiliario;Codigo_Negociacao;Mercado;Data_Inicio_Negociacao;Data_Fim_Negociacao"

	modified = "Mon, 16 Nov 2026 12:00:00 GMT"
)

var (
	names = map[string]string{weg: "WEG S.A.", ind: "IND SA", banco: "BANCO X"}

	statementKinds = []string{
		"BPA_con", "BPA_ind", "BPP_con", "BPP_ind", "DRE_con", "DRE_ind",
		"DFC_MI_con", "DFC_MI_ind", "DFC_MD_con", "DFC_MD_ind",
	}
)

func TestFetch(t *testing.T) {
	t.Parallel()

	srv := newServer(t, fixtureFiles(t, "fca_cia_aberta_2026.zip"))
	src := brcvmcia.New(srv.client(), srv.URL)

	got, err := src.Fetch(t.Context(), today())
	if err != nil {
		t.Fatal(err)
	}

	if got.Currency != "BRL" {
		t.Fatalf("currency = %q, want BRL", got.Currency)
	}

	if want := wantWindow(); !slices.Equal(got.Window, want) {
		t.Fatalf("window = %v, want %v", got.Window, want)
	}

	if want := wantFiles(); !reflect.DeepEqual(got.Files, want) {
		t.Fatalf("files = %+v, want %+v", got.Files, want)
	}

	if want := wantListings(); !reflect.DeepEqual(got.Listings, want) {
		t.Fatalf("listings = %+v, want %+v", got.Listings, want)
	}

	t.Run("unchanged files", func(t *testing.T) {
		again, err := src.Fetch(t.Context(), today())
		if err != nil {
			t.Fatal(err)
		}

		if len(again.Files) != 0 || again.Listings != nil {
			t.Fatalf("unchanged files returned %+v, want none", again)
		}

		if !slices.Equal(again.Window, wantWindow()) {
			t.Fatalf("window = %v, want %v", again.Window, wantWindow())
		}
	})

	t.Run("listings of the year before", func(t *testing.T) {
		srv := newServer(t, fixtureFiles(t, "fca_cia_aberta_2025.zip"))

		again, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
		if err != nil {
			t.Fatal(err)
		}

		if want := wantListings(); !reflect.DeepEqual(again.Listings, want) {
			t.Fatalf("listings = %+v, want %+v", again.Listings, want)
		}
	})
}

func TestFetchMalformedFile(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		members func(m map[string]string)
		want    string
	}{
		"DRE_con without CD_CONTA": {
			members: func(m map[string]string) {
				key := "dfp_cia_aberta_DRE_con_2025.csv"
				m[key] = strings.Replace(m[key], "CD_CONTA", "OTHER", 1)
			},
			want: "CD_CONTA",
		},
		"archive without BPP_con": {
			members: func(m map[string]string) { delete(m, "dfp_cia_aberta_BPP_con_2025.csv") },
			want:    "BPP_con",
		},
	} {
		t.Run(name, func(t *testing.T) {
			m := dfp2025Members()
			tc.members(m)

			srv := newServer(t, map[string][]byte{
				"/DFP/DADOS/dfp_cia_aberta_2025.zip": zipOf(t, m),
			})

			_, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err == nil {
				t.Fatal("accepted")
			}

			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not name %q", err, tc.want)
			}
		})
	}
}

func TestFetchHigherCodeOfTwoLines(t *testing.T) {
	t.Parallel()

	book := filing{weg, "2025-09-30", "1", mil, last, "", "2025-09-30"}
	year := book.since("2025-01-01")
	srv := newServer(t, map[string][]byte{
		"/ITR/DADOS/itr_cia_aberta_2025.zip": zipOf(t, members("itr", "2025", map[string][]string{
			"": {general(weg, "2025-09-30", "1", "2025-10-29")},
			"BPP_con": {
				book.balance("2.03", "Patrimônio Líquido Consolidado", "100"),
				book.balance("2.07", "Patrimônio Líquido Atribuído", "200"),
			},
			"DRE_con": {
				year.flow("3.09", "Lucro/Prejuízo Consolidado do Período", "10"),
				year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "20"),
			},
		})),
	})

	got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
	if err != nil {
		t.Fatal(err)
	}

	if len(got.Files) != 1 || len(got.Files[0].Reports) != 1 {
		t.Fatalf("files = %+v, want one report", got.Files)
	}

	rep := got.Files[0].Reports[0]
	if rep.Equity == nil || *rep.Equity != 20000000 {
		t.Fatalf("equity = %v, want 20000000", rep.Equity)
	}

	if rep.NetIncome == nil || *rep.NetIncome != 2000000 {
		t.Fatalf("net income = %v, want 2000000", rep.NetIncome)
	}
}

// Real DFP of 2021: a fiscal year from 2020-03-31 to 2021-03-31 spans twelve months, a short
// first fiscal year its whole months, and a span longer than twelve months is not stored.
func TestFetchMonthsOfAFiscalYear(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		ini, fim string
		months   int
	}{
		"starts on the last day of a month": {"2024-03-31", "2025-03-31", 12},
		"short first fiscal year":           {"2025-02-26", "2025-12-31", 10},
		"one month":                         {"2025-12-01", "2025-12-31", 1},
		"thirteen months":                   {"2024-01-01", "2025-01-31", 0},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			year := filing{weg, tc.fim, "1", mil, last, tc.ini, tc.fim}
			srv := newServer(t, map[string][]byte{
				"/DFP/DADOS/dfp_cia_aberta_2025.zip": zipOf(
					t,
					members("dfp", "2025", map[string][]string{
						"": {general(weg, tc.fim, "1", "2026-02-27")},
						"DRE_con": {
							year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "10"),
						},
					}),
				),
			})

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			var months []int
			for _, f := range got.Files {
				for _, r := range f.Reports {
					months = append(months, r.Months)
				}
			}

			want := []int{tc.months}
			if tc.months == 0 {
				want = nil
			}

			if !slices.Equal(months, want) {
				t.Fatalf("months = %v, want %v", months, want)
			}
		})
	}
}

func today() time.Time { return time.Date(2026, time.November, 18, 0, 0, 0, 0, time.UTC) }

func wantWindow() []string {
	return []string{
		"dfp_2025", "dfp_2024", "dfp_2023", "dfp_2022", "dfp_2021", "itr_2026", "itr_2025",
	}
}

func wantListings() []companyreport.Listing {
	return []companyreport.Listing{
		{Exchange: "BVMF", Code: "BNCX4", Identifier: "22222222000122", Name: "BANCO X"},
		{Exchange: "BVMF", Code: "INDS3", Identifier: "11111111000111", Name: "IND SA"},
		{Exchange: "BVMF", Code: "WEGE3", Identifier: "84429695000111", Name: "WEG S.A."},
	}
}

func wantFiles() []companyreport.File {
	return []companyreport.File{
		{Name: "dfp_2025", Reports: []companyreport.Report{
			{
				Identifier: "11111111000111", Period: date(2025, time.June, 30), Months: 12,
				Name: "IND SA", Plan: "standard", Delivered: day(2025, time.September, 15),
				TotalAssets: num(100001), CurrentAssets: num(40000), Equity: num(60000),
				Revenue: num(0), NetIncome: num(-5000),
			},
			{
				Identifier: "22222222000122", Period: date(2025, time.December, 31), Months: 12,
				Name: "BANCO X", Consolidated: true, Plan: "other",
				Delivered:   day(2026, time.March, 20),
				TotalAssets: num(90000000000), Equity: num(8000000000), NetIncome: num(900000000),
				OperatingCashFlow: num(300000000),
			},
			{
				Identifier: "84429695000111", Period: date(2025, time.December, 31), Months: 12,
				Name: "WEG S.A.", Consolidated: true, Plan: "standard",
				Delivered:   day(2026, time.February, 27),
				TotalAssets: num(5000000000), CurrentAssets: num(3000000000), Cash: num(500000000),
				ShortInvestments: num(200000000), CurrentLiabilities: num(1500000000),
				ShortDebt: num(100000000), LongDebt: num(300000000), Equity: num(2000000000),
				Revenue: num(4000000000), GrossProfit: num(1300000000), NetIncome: num(600050000),
				OperatingCashFlow: num(700000000), SharesIssued: num(4197317998),
				SharesTreasury: num(1488307),
			},
		}},
		{Name: "itr_2026", Reports: []companyreport.Report{
			{
				Identifier: "84429695000111", Period: date(2026, time.September, 30), Months: 9,
				Name: "WEG S.A.", Consolidated: true, Plan: "standard",
				Delivered:   day(2026, time.October, 28),
				TotalAssets: num(5200000000), CurrentAssets: num(3100000000), Cash: num(600000000),
				ShortInvestments: num(100000000), CurrentLiabilities: num(1600000000),
				ShortDebt: num(150000000), LongDebt: num(250000000), Equity: num(2100000000),
				Revenue: num(3000000000), GrossProfit: num(1000000000), NetIncome: num(500000000),
				OperatingCashFlow: num(550000000), SharesIssued: num(4197317998),
				SharesTreasury: num(1488307),
			},
		}},
		{Name: "itr_2025", Reports: []companyreport.Report{
			{
				Identifier: "84429695000111", Period: date(2025, time.September, 30), Months: 9,
				Name: "WEG S.A.", Consolidated: true, Plan: "standard",
				Delivered:   day(2025, time.October, 29),
				TotalAssets: num(4800000000), CurrentAssets: num(2800000000),
				Revenue: num(2900000000), NetIncome: num(480000000),
			},
		}},
	}
}

// fixtureFiles maps the four archives of the Fixture; fca is the name of the listing archive.
func fixtureFiles(t *testing.T, fca string) map[string][]byte {
	t.Helper()

	return map[string][]byte{
		"/DFP/DADOS/dfp_cia_aberta_2025.zip": zipOf(t, dfp2025Members()),
		"/ITR/DADOS/itr_cia_aberta_2026.zip": zipOf(t, itr2026Members()),
		"/ITR/DADOS/itr_cia_aberta_2025.zip": zipOf(t, itr2025Members()),
		"/FCA/DADOS/" + fca: zipOf(
			t,
			listingMembers(strings.Contains(fca, "2025")),
		),
	}
}

func dfp2025Members() map[string]string {
	wegV1 := filing{weg, "2025-12-31", "1", mil, last, "", "2025-12-31"}
	wegV2 := filing{weg, "2025-12-31", "2", mil, last, "", "2025-12-31"}
	wegV2Year := wegV2.since("2025-01-01")
	wegV2Before := filing{weg, "2025-12-31", "2", mil, before, "", "2024-12-31"}
	bancoV1 := filing{banco, "2025-12-31", "1", mil, last, "", "2025-12-31"}
	bancoYear := bancoV1.since("2025-01-01")
	indV1 := filing{ind, "2025-06-30", "1", unit, last, "", "2025-06-30"}
	indYear := filing{ind, "2025-06-30", "1", unit, last, "2024-07-01", "2025-06-30"}

	return members("dfp", "2025", map[string][]string{
		"": {
			general(weg, "2025-12-31", "1", "2026-02-20"),
			general(weg, "2025-12-31", "2", "2026-02-27"),
			general(ind, "2025-06-30", "1", "2025-09-15"),
			general(banco, "2025-12-31", "1", "2026-03-20"),
		},
		"BPA_con": {
			wegV1.balance("1", "Ativo Total", "1"),
			wegV2.balance("1", "Ativo Total", "50000"),
			wegV2.balance("1.01", "Ativo Circulante", "30000"),
			wegV2.balance("1.01.01", "Caixa e Equivalentes de Caixa", "5000"),
			wegV2.balance("1.01.02", "Aplicações Financeiras", "2000"),
			wegV2Before.balance("1", "Ativo Total", "45000"),
			bancoV1.balance("1", "Ativo Total", "900000"),
			bancoV1.balance("1.01", "Caixa e Equivalentes de Caixa", "1000"),
		},
		"BPP_con": {
			wegV2.balance("2.01", "Passivo Circulante", "15000"),
			wegV2.balance("2.01.04", "Empréstimos e Financiamentos", "1000"),
			wegV2.balance("2.02.01", "Empréstimos e Financiamentos", "3000"),
			wegV2.balance("2.03", "Patrimônio Líquido Consolidado", "20000"),
			bancoV1.balance("2.03", "Provisões", "50"),
			bancoV1.balance("2.08", "Patrimônio Líquido Consolidado", "80000"),
		},
		"DRE_con": {
			wegV2Year.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "40000"),
			wegV2Year.flow("3.03", "Resultado Bruto", "13000"),
			wegV2Year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "6000.5"),
			wegV2Year.flow("3.11.01", "Atribuído a Sócios da Empresa Controladora", "5800"),
			bancoYear.flow("3.01", "Receitas da Intermediação Financeira", "70000"),
			bancoYear.flow("3.09", "Lucro/Prejuízo Consolidado do Período", "9000"),
			bancoYear.flow("3.11", "Reversão dos Juros sobre Capital Próprio", "0"),
		},
		"DFC_MI_con": {wegV2Year.flow("6.01", "Caixa Líquido Atividades Operacionais", "7000")},
		"DFC_MD_con": {bancoYear.flow("6.01", "Caixa Líquido Atividades Operacionais", "3000")},
		"BPA_ind": {
			wegV2.balance("1", "Ativo Total", "99999"),
			indV1.balance("1", "Ativo Total", "1000.005"),
			indV1.balance("1.01", "Ativo Circulante", "400"),
		},
		"BPP_ind": {indV1.balance("2.03", "Patrimônio Líquido", "600")},
		"DRE_ind": {
			wegV2Year.flow("3.11", "Lucro/Prejuízo do Período", "1"),
			indYear.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "0"),
			indYear.flow("3.11", "Lucro/Prejuízo do Período", "-50"),
		},
		"composicao_capital": {
			line(weg, "2025-12-31", "2", "WEG S.A.", "4197317998", "0", "4197317998",
				"1488307", "0", "1488307"),
			line(weg, "2025-12-31", "1", "WEG S.A.", "1", "0", "1", "1", "0", "1"),
		},
	})
}

func itr2026Members() map[string]string {
	book := filing{weg, "2026-09-30", "1", mil, last, "", "2026-09-30"}
	quarter := book.since("2026-07-01")
	year := book.since("2026-01-01")

	return members("itr", "2026", map[string][]string{
		"": {general(weg, "2026-09-30", "1", "2026-10-28")},
		"BPA_con": {
			book.balance("1", "Ativo Total", "52000"),
			book.balance("1.01", "Ativo Circulante", "31000"),
			book.balance("1.01.01", "Caixa e Equivalentes de Caixa", "6000"),
			book.balance("1.01.02", "Aplicações Financeiras", "1000"),
		},
		"BPP_con": {
			book.balance("2.01", "Passivo Circulante", "16000"),
			book.balance("2.01.04", "Empréstimos e Financiamentos", "1500"),
			book.balance("2.02.01", "Empréstimos e Financiamentos", "2500"),
			book.balance("2.03", "Patrimônio Líquido Consolidado", "21000"),
		},
		"DRE_con": {
			quarter.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "10000"),
			quarter.flow("3.03", "Resultado Bruto", "3500"),
			quarter.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "1700"),
			year.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "30000"),
			year.flow("3.03", "Resultado Bruto", "10000"),
			year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "5000"),
		},
		"DFC_MI_con": {year.flow("6.01", "Caixa Líquido Atividades Operacionais", "5500")},
		"composicao_capital": {
			line(weg, "2026-09-30", "1", "WEG S.A.", "4197317998", "0", "4197317998",
				"1488307", "0", "1488307"),
		},
	})
}

func itr2025Members() map[string]string {
	book := filing{weg, "2025-09-30", "1", mil, last, "", "2025-09-30"}
	year := book.since("2025-01-01")

	return members("itr", "2025", map[string][]string{
		"": {general(weg, "2025-09-30", "1", "2025-10-29")},
		"BPA_con": {
			book.balance("1", "Ativo Total", "48000"),
			book.balance("1.01", "Ativo Circulante", "28000"),
		},
		"DRE_con": {
			year.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "29000"),
			year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "4800"),
		},
	})
}

// listingMembers is the FCA archive; the member carries the year in its name.
func listingMembers(yearBefore bool) map[string]string {
	year := "2026"
	if yearBefore {
		year = "2025"
	}

	rows := []string{
		line(weg, "2026-01-01", "1", "1", "WEG S.A.", "Ações Ordinárias", "WEGE3", "Bolsa",
			"2007-06-22", ""),
		line(ind, "2026-01-01", "1", "2", "IND SA", "Ações Ordinárias", "OLDS3", "Bolsa",
			"2010-01-04", ""),
		line(ind, "2026-01-01", "2", "5", "IND SA", "Ações Ordinárias", "INDS3", "Bolsa",
			"2010-01-04", ""),
		line(banco, "2026-01-01", "1", "3", "BANCO X", "Ações Preferenciais", "BNCX4", "Bolsa",
			"2010-01-04", ""),
		line(banco, "2026-01-01", "1", "3", "BANCO X", "Ações Ordinárias", "BNCX3", "Bolsa",
			"2010-01-04", "2024-05-01"),
		line(banco, "2026-01-01", "1", "3", "BANCO X", "Debêntures", "BNCX11",
			"Balcão Organizado", "2020-01-01", ""),
		line("33.333.333/0001-33", "2026-01-01", "1", "4", "OUTRA SA", "Ações Ordinárias",
			"DUPL3", "Bolsa", "2020-01-01", ""),
		line("44.444.444/0001-44", "2026-01-01", "1", "6", "MAIS SA", "Ações Ordinárias",
			"DUPL3", "Bolsa", "2020-01-01", ""),
	}

	return map[string]string{
		"fca_cia_aberta_valor_mobiliario_" + year + ".csv": listingHeader + "\n" +
			strings.Join(rows, "\n") + "\n",
	}
}

// filing is the fields every row of one company, period and version share.
type filing struct {
	cnpj, ref, version, scale, order, ini, fim string
}

func (f filing) since(ini string) filing {
	f.ini = ini

	return f
}

func (f filing) balance(code, description, value string) string {
	return line(f.cnpj, f.ref, f.version, names[f.cnpj], "1", "DF", "REAL", f.scale, f.order,
		f.fim, code, description, value, "S")
}

func (f filing) flow(code, description, value string) string {
	return line(f.cnpj, f.ref, f.version, names[f.cnpj], "1", "DF", "REAL", f.scale, f.order,
		f.ini, f.fim, code, description, value, "S")
}

func general(cnpj, ref, version, received string) string {
	return line(cnpj, ref, version, names[cnpj], "1", "DFP", "1", received, "link")
}

func line(fields ...string) string { return strings.Join(fields, ";") }

// members names the members of one archive after its prefix ("dfp") and year, writing the
// header of every statement member and of the capital member and the rows given by kind.
func members(prefix, year string, rows map[string][]string) map[string]string {
	out := map[string]string{}
	base := prefix + "_cia_aberta_"

	put := func(name, header string, kind string) {
		out[base+name+year+".csv"] = header + "\n" + strings.Join(rows[kind], "\n") + "\n"
	}

	put("", generalHeader, "")
	put("composicao_capital_", capitalHeader, "composicao_capital")

	for _, kind := range statementKinds {
		header := balanceHeader
		if strings.HasPrefix(kind, "DRE") || strings.HasPrefix(kind, "DFC") {
			header = flowHeader
		}

		put(kind+"_", header, kind)
	}

	return out
}

func num(n int64) *int64 { return &n }

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func day(y int, m time.Month, d int) *time.Time {
	v := date(y, m, d)

	return &v
}

// zipOf writes each member in Latin-1: every rune of a content is one byte.
func zipOf(t *testing.T, members map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	for name, content := range members {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		raw := make([]byte, 0, len(content))

		for _, r := range content {
			if r > 0xff {
				t.Fatalf("member %s holds %q, outside Latin-1", name, r)
			}

			raw = append(raw, byte(r))
		}

		if _, err := w.Write(raw); err != nil {
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

func (s *server) client() *http.Client { return s.Server.Client() }
