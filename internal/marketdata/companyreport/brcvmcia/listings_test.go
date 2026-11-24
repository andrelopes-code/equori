package brcvmcia_test

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
	"github.com/andrelopes-code/equori/internal/marketdata/companyreport/brcvmcia"
)

func TestFetchListingWithoutCode(t *testing.T) {
	t.Parallel()

	const btg = "30.306.294/0001-45"

	for name, tc := range map[string]struct {
		cnpj, security, code, composition, market, end string
		want                                           []companyreport.Listing
	}{
		"CR4 the code the exchange gives the company": {
			cnpj: btg, security: "Units", code: "000000", composition: "1 ON E 2 PNA",
			market: "Bolsa",
			want:   []companyreport.Listing{listing("BPAC11", "30306294000145", 3)},
		},
		"CR4 a filed code wins": {
			cnpj: btg, security: "Ações Ordinárias", code: "BPAC3", market: "Bolsa",
			want: []companyreport.Listing{listing("BPAC3", "30306294000145", 1)},
		},
		"CR4 a lower case code": {
			cnpj: weg, security: "Ações Ordinárias", code: "wege3", market: "Bolsa",
			want: []companyreport.Listing{listing("WEGE3", "84429695000111", 1)},
		},
		"CR4 no code for the company": {
			cnpj: weg, security: "Ações Ordinárias", code: "000000", market: "Bolsa",
			want: []companyreport.Listing{},
		},
		"CR4 outside the exchange": {
			cnpj: btg, security: "Debêntures", market: "Balcão Organizado",
			want: []companyreport.Listing{},
		},
		"CR4 no longer traded": {
			cnpj: btg, security: "Units", code: "000000", composition: "1 ON E 2 PNA",
			market: "Bolsa", end: "2025-01-01",
			want: []companyreport.Listing{},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
			files["/FCA/DADOS/fca_cia_aberta_2026.zip"] = zipOf(t, map[string]string{
				"fca_cia_aberta_valor_mobiliario_2026.csv": listingHeader + "\n" +
					line(tc.cnpj, "2026-01-01", "1", "1", "X SA", tc.security, tc.code,
						tc.composition, tc.market, "2012-04-26", tc.end) + "\n",
				"fca_cia_aberta_geral_2026.csv": sectorHeader + "\n",
			})
			srv := newServer(t, files)

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(got.Listings, tc.want) {
				t.Fatalf("listings = %+v, want %+v", got.Listings, tc.want)
			}
		})
	}
}

func TestFetchFinancialCompany(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		sectors string
		want    bool
	}{
		"CR4 a bank":                {sectorRow(weg, "1", "Bancos"), true},
		"CR4 an insurer":            {sectorRow(weg, "1", "Seguradoras e Corretoras"), true},
		"CR4 a holding of finance":  {sectorRow(weg, "1", "Emp. Adm. Part. - Intermediação Financeira"), true},
		"CR4 a holding of industry": {sectorRow(weg, "1", "Emp. Adm. Part. - Papel e Celulose"), false},
		"CR4 a holding of no sector": {
			sectorRow(weg, "1", "Emp. Adm. Part. - Sem Setor Principal"), false,
		},
		"CR4 the highest version": {
			sectorRow(weg, "2", "Bancos") + sectorRow(weg, "1", "Alimentos"), true,
		},
		"CR4 another company": {sectorRow(banco, "1", "Bancos"), false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
			files["/FCA/DADOS/fca_cia_aberta_2026.zip"] = zipOf(t, map[string]string{
				"fca_cia_aberta_valor_mobiliario_2026.csv": listingHeader + "\n" +
					line(weg, "2026-01-01", "1", "1", "X SA", "Ações Ordinárias", "WEGE3", "",
						"Bolsa", "2007-06-22", "") + "\n",
				"fca_cia_aberta_geral_2026.csv": sectorHeader + "\n" + tc.sectors,
			})
			srv := newServer(t, files)

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			if len(got.Listings) != 1 || got.Listings[0].Financial != tc.want {
				t.Fatalf("listings = %+v, want financial %t", got.Listings, tc.want)
			}
		})
	}
}

func listing(code, identifier string, shares int) companyreport.Listing {
	return companyreport.Listing{
		Exchange:      "BVMF",
		Code:          code,
		Identifier:    identifier,
		Name:          "X SA",
		SharesPerUnit: count(shares),
	}
}
