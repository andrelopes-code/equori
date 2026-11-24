package brcvmcia_test

import (
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/companyreport/brcvmcia"
)

const shareHeader = "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Companhia;" +
	"ID_Capital_Social;Tipo_Capital;Data_Autorizacao_Aprovacao;Valor_Capital;" +
	"Prazo_Integralizacao;Quantidade_Acoes_Ordinarias;Quantidade_Acoes_Preferenciais;" +
	"Quantidade_Total_Acoes"

func TestFetchShareCounts(t *testing.T) {
	t.Parallel()

	files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
	files["/FRE/DADOS/fre_cia_aberta_2026.zip"] = zipOf(t, shareMembers("2026",
		// The highest version, then the paid-in capital, then the latest approval.
		shareRow(weg, "1", "Capital Integralizado", "2026-01-01", "1"),
		shareRow(weg, "2", "Capital Emitido", "2026-05-01", "2"),
		shareRow(weg, "2", "Capital Integralizado", "2025-01-01", "3"),
		shareRow(weg, "2", "Capital Integralizado", "2026-04-01", "4197317998"),
		shareRow(weg, "2", "Capital Autorizado", "2026-06-01", "9"),
		shareRow(banco, "1", "Capital Emitido", "2026-04-01", "700"),
		shareRow(banco, "1", "Capital Integralizado", "2026-04-01", "0"),
		shareRow(ind, "1", "Capital Emitido", "2026-04-01", "x"),
	))
	srv := newServer(t, files)

	got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
	if err != nil {
		t.Fatal(err)
	}

	if want := []int{2026, 2025, 2024, 2023, 2022, 2021}; !slices.Equal(got.CountYears, want) {
		t.Fatalf("count years = %v, want %v", got.CountYears, want)
	}

	want := []companyreport.CountFile{{Year: 2026, Counts: []companyreport.ShareCount{
		{Identifier: "22222222000122", Shares: 700},
		{Identifier: "84429695000111", Shares: 4197317998},
	}}}
	if !reflect.DeepEqual(got.Counts, want) {
		t.Fatalf("counts = %+v, want %+v", got.Counts, want)
	}
}

func TestFetchUnitComposition(t *testing.T) {
	t.Parallel()

	for composition, want := range map[string]*int{
		"1 ON E 2 PN":       count(3),
		"1 ON / 2 PN":       count(3),
		"1 ON e 4 PNA":      count(5),
		"1 KLBN3 + 4 KLBN4": count(5),
		"2 ações preferenciais e 1 ação ordinária": count(3),
		"1 ação ordinária e 4 ações preferenciais": count(5),
		"90 ON + 20 PN":   nil,
		"a definir":       nil,
		"":                nil,
		"04 (quatro)":     nil,
		"383.768 bilhões": nil,
	} {
		t.Run(composition, func(t *testing.T) {
			t.Parallel()

			files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
			files["/FCA/DADOS/fca_cia_aberta_2026.zip"] = zipOf(t, map[string]string{
				"fca_cia_aberta_geral_2026.csv": sectorHeader + "\n",
				"fca_cia_aberta_valor_mobiliario_2026.csv": listingHeader + "\n" +
					line(weg, "2026-01-01", "1", "1", "WEG S.A.", "Units", "WEGE11", composition,
						"Bolsa", "2007-06-22", "") + "\n",
			})
			srv := newServer(t, files)

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			if len(got.Listings) != 1 ||
				!reflect.DeepEqual(got.Listings[0].SharesPerUnit, want) {
				t.Fatalf("listings = %+v, want shares per unit %v", got.Listings, want)
			}
		})
	}
}

func TestFetchParentAndClasses(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		income   []string
		equity   []string
		perShare [2]string
		kinds    [2]string
		parent   *int64
		minority *int64
		differ   bool
	}{
		"consolidated lines": {
			income:   []string{"3.11.01", "Atribuído a Sócios da Empresa Controladora", "5800"},
			equity:   []string{"2.03.09", "Participação dos Acionistas Não Controladores", "200"},
			perShare: [2]string{"1.10", "1.21"},
			parent:   num(580000000),
			minority: num(20000000),
		},
		"other wording, classes of different rights": {
			income: []string{"3.13.01", "Atribuído aos Sócios da Empresa Controladora", "0"},
			equity: []string{
				"2.07.02", "Patrimônio Líquido Atribuído aos Não Controladores", "0",
			},
			perShare: [2]string{"0.0949", "0.9492"},
			parent:   num(0),
			minority: num(0),
			differ:   true,
		},
		"holders of the subsidiaries alone": {
			income:   []string{"3.11.02", "Atribuído a Sócios Não Controladores", "10"},
			equity:   []string{"2.03.09", "Outros Resultados Abrangentes", "1"},
			perShare: [2]string{"0", "4.05"},
		},
		"a class without earnings in a company of both kinds": {
			income:   []string{"3.11.02", "Atribuído a Sócios Não Controladores", "10"},
			equity:   []string{"2.03.09", "Outros Resultados Abrangentes", "1"},
			perShare: [2]string{"0.67", "0"},
			kinds:    [2]string{"99", "1"},
			differ:   true,
		},
		"a golden share without earnings": {
			income:   []string{"3.11.02", "Atribuído a Sócios Não Controladores", "10"},
			equity:   []string{"2.03.09", "Outros Resultados Abrangentes", "1"},
			perShare: [2]string{"0.67", "0"},
			kinds:    [2]string{"100", "1"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			members := dfp2025Members()
			year := filing{weg, "2025-12-31", "2", mil, last, "2025-01-01", "2025-12-31"}
			income := "dfp_cia_aberta_DRE_con_2025.csv"
			members[income] = strings.Replace(members[income],
				year.flow("3.11.01", "Atribuído a Sócios da Empresa Controladora", "5800"),
				year.flow(tc.income[0], tc.income[1], tc.income[2])+"\n"+
					year.flow("3.99.01.01", "ON", tc.perShare[0])+"\n"+
					year.flow("3.99.01.02", "PN", tc.perShare[1])+"\n"+
					year.flow("3.99.02.01", "ON", "99"), 1)
			members["dfp_cia_aberta_BPP_con_2025.csv"] += year.balance(
				tc.equity[0], tc.equity[1], tc.equity[2]) + "\n"

			if tc.kinds[0] != "" {
				capitals := "dfp_cia_aberta_composicao_capital_2025.csv"
				members[capitals] = strings.Replace(members[capitals], ";4197317998;0;",
					";"+tc.kinds[0]+";"+tc.kinds[1]+";", 1)
			}

			files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
			files["/DFP/DADOS/dfp_cia_aberta_2025.zip"] = zipOf(t, members)
			srv := newServer(t, files)

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			rep := wegReport(t, got, time.Date(2025, time.December, 31, 0, 0, 0, 0, time.UTC))
			if !reflect.DeepEqual(rep.NetIncomeParent, tc.parent) ||
				!reflect.DeepEqual(rep.EquityMinority, tc.minority) ||
				rep.ClassesDiffer != tc.differ {
				t.Fatalf("report = %+v, want parent %v, minority %v, differ %v",
					rep, tc.parent, tc.minority, tc.differ)
			}
		})
	}
}

func wegReport(
	t *testing.T,
	snap companyreport.Snapshot,
	period time.Time,
) companyreport.Report {
	t.Helper()

	for _, f := range snap.Files {
		for _, r := range f.Reports {
			if r.Identifier == "84429695000111" && r.Period.Equal(period) {
				return r
			}
		}
	}

	t.Fatal("the report of WEG is missing")

	return companyreport.Report{}
}

func shareMembers(year string, rows ...string) map[string]string {
	return map[string]string{
		"fre_cia_aberta_capital_social_" + year + ".csv": shareHeader + "\n" +
			strings.Join(rows, "\n") + "\n",
	}
}

func shareRow(cnpj, version, kind, approved, total string) string {
	return line(cnpj, "2026-12-31", version, "1", names[cnpj], "1", kind, approved, "10.00", "",
		total, "0", total)
}
