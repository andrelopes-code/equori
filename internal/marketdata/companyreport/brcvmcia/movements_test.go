package brcvmcia_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport/brcvmcia"
)

const (
	shareCapital = "Capital Social Integralizado"
	parentEquity = "Patrimônio Líquido"
)

func TestFetchCapitalRaised(t *testing.T) {
	t.Parallel()

	year := filing{weg, "2025-12-31", "2", mil, last, "2025-01-01", "2025-12-31"}
	prior := filing{weg, "2025-12-31", "2", mil, before, "2024-01-01", "2024-12-31"}
	old := filing{weg, "2025-12-31", "1", mil, last, "2025-01-01", "2025-12-31"}
	yes, no := true, false

	for name, tc := range map[string]struct {
		rows []string
		want *bool
	}{
		"CR5 new resources": {
			[]string{
				year.movement(shareCapital, "5.04.01", "Aumentos de Capital", "1000"),
				year.movement(parentEquity, "5.04.01", "Aumentos de Capital", "1000"),
			}, &yes,
		},
		"CR5 reserves": {
			[]string{
				year.movement(shareCapital, "5.04.14", "Capitalização por Reservas", "46181"),
				year.movement(parentEquity, "5.04.14", "Capitalização por Reservas", "0"),
			}, &no,
		},
		"CR5 reserves among the internal changes": {
			[]string{year.movement(shareCapital, "5.06.06", "Aumento de Capital", "400")}, &no,
		},
		"CR5 reserves and new resources": {
			[]string{
				year.movement(shareCapital, "5.04.09", "Emissão para reservas", "30000"),
				year.movement(shareCapital, "5.04.10", "Incorporação de ações", "35"),
				year.movement(parentEquity, "5.04.10", "Incorporação de ações", "37"),
			}, &yes,
		},
		"CR5 a reduction": {
			[]string{
				year.movement(shareCapital, "5.04.11", "Redução de Capital", "-2000"),
				year.movement(parentEquity, "5.04.11", "Redução de Capital", "-2000"),
			}, nil,
		},
		"CR5 equity without share capital": {
			[]string{
				year.movement(shareCapital, "5.04.03", "Opções Outorgadas", "0"),
				year.movement(parentEquity, "5.04.03", "Opções Outorgadas", "18"),
			}, nil,
		},
		"CR5 sums and details are not read": {
			[]string{
				year.movement(shareCapital, "5.04", "Transações de Capital", "5"),
				year.movement(parentEquity, "5.04", "Transações de Capital", "5"),
				year.movement(shareCapital, "5.04.01.02", "Detalhe", "5"),
				year.movement(parentEquity, "5.04.01.02", "Detalhe", "5"),
				year.movement(shareCapital, "5.07", "Saldos Finais", "900"),
			}, nil,
		},
		"CR5 the year before and an old version": {
			[]string{
				prior.movement(shareCapital, "5.04.01", "Aumentos de Capital", "5"),
				old.movement(shareCapital, "5.04.01", "Aumentos de Capital", "5"),
			}, nil,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			members := dfp2025Members()
			for _, row := range tc.rows {
				members["dfp_cia_aberta_DMPL_con_2025.csv"] += row + "\n"
			}

			files := fixtureFiles(t, "fca_cia_aberta_2026.zip")
			files["/DFP/DADOS/dfp_cia_aberta_2025.zip"] = zipOf(t, members)
			srv := newServer(t, files)

			got, err := brcvmcia.New(srv.client(), srv.URL).Fetch(t.Context(), today())
			if err != nil {
				t.Fatal(err)
			}

			rep := wegReport(t, got, time.Date(2025, time.December, 31, 0, 0, 0, 0, time.UTC))
			if !reflect.DeepEqual(rep.CapitalRaised, tc.want) {
				t.Fatalf("capital raised = %v, want %v", rep.CapitalRaised, tc.want)
			}
		})
	}
}
