package brcvmcia

import (
	"archive/zip"
	"cmp"
	"fmt"
	"os"
	"regexp"
	"slices"
	"strconv"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
)

const exchange = "BVMF"

var codePattern = regexp.MustCompile(`^[A-Z0-9]{4}[0-9]{1,2}$`)

// listed is a candidate listing and the version of the row it came from.
type listed struct {
	version int
	listing companyreport.Listing
}

// readListings reads the member valor_mobiliario of the FCA of year (CR4).
func readListings(f *os.File, size int64, year int) ([]companyreport.Listing, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	required := []string{
		"CNPJ_Companhia", "Versao", "Nome_Empresarial", "Codigo_Negociacao", "Mercado",
		"Data_Fim_Negociacao",
	}
	newest := map[string]int{}

	var rows []listed

	err = readMember(
		zr,
		"fca_cia_aberta_valor_mobiliario_"+strconv.Itoa(year)+".csv",
		required,
		func(r record) {
			version, err := strconv.Atoi(r.get("Versao"))
			if err != nil {
				return
			}

			id := identifierReplacer.Replace(r.get("CNPJ_Companhia"))
			newest[id] = max(newest[id], version)

			code := r.get("Codigo_Negociacao")
			if r.get("Mercado") != "Bolsa" || r.get("Data_Fim_Negociacao") != "" ||
				!codePattern.MatchString(code) {
				return
			}

			rows = append(rows, listed{version, companyreport.Listing{
				Exchange:   exchange,
				Code:       code,
				Identifier: id,
				Name:       r.get("Nome_Empresarial"),
			}})
		},
	)
	if err != nil {
		return nil, err
	}

	return pick(rows, newest), nil
}

// pick keeps the rows of the highest version of their company, without a code that two
// companies give, one listing per code. The result is never nil.
func pick(rows []listed, newest map[string]int) []companyreport.Listing {
	owner := map[string]string{}
	shared := map[string]bool{}
	current := []companyreport.Listing{}

	for _, row := range rows {
		l := row.listing
		if row.version != newest[l.Identifier] {
			continue
		}

		if id, ok := owner[l.Code]; ok && id != l.Identifier {
			shared[l.Code] = true
		}

		if _, ok := owner[l.Code]; !ok {
			current = append(current, l)
		}

		owner[l.Code] = l.Identifier
	}

	current = slices.DeleteFunc(
		current,
		func(l companyreport.Listing) bool { return shared[l.Code] },
	)
	slices.SortFunc(current, func(a, b companyreport.Listing) int {
		return cmp.Compare(a.Code, b.Code)
	})

	return current
}
