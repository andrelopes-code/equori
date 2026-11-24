package brcvmcia

import (
	"archive/zip"
	"cmp"
	"fmt"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
)

const exchange = "BVMF"

const (
	unitSecurity   = "Units"
	maxUnitsShares = 100
)

// holdingPrefix starts the sector of a holding: the sector of its companies follows.
const holdingPrefix = "Emp. Adm. Part. - "

var (
	// financialSectors names the sectors of the financial companies among those of the register.
	financialSectors = []string{
		"Arrendamento Mercantil",
		"Bancos",
		"Bolsas de Valores/Mercadorias e Futuros",
		"Crédito Imobiliário",
		"Intermediação Financeira",
		"Securitização de Recebíveis",
		"Seguradoras e Corretoras",
	}

	codePattern = regexp.MustCompile(`^[A-Z][A-Z0-9]{3}[0-9]{1,2}$`)
	// unitPart is a number of a composition and the class of share it counts.
	unitPart = regexp.MustCompile(`([0-9]+)\s+(?:ON|PN|aç|[A-Z]{4}[0-9])`)
	// exchangeCodes names, by identifier, the security of each company whose filing gives no
	// trading code, as the exchange lists it on 2026-11-24.
	// shortcut: kept by hand, read the exchange's company list when a company is missing.
	exchangeCodes = map[string]string{
		"03853896000140": "MBRF3",
		"05917486000140": "WDCN3",
		"08902291000115": "CMIN3",
		"30306294000145": "BPAC11",
		"33042730000104": "CSNA3",
		"59693110000129": "OBTC3",
		"61189288000189": "AMAR3",
	}
)

// listed is a candidate listing and the version of the row it came from.
type listed struct {
	version int
	listing companyreport.Listing
}

// readListings reads the members geral and valor_mobiliario of the FCA of year (CR4).
func readListings(f *os.File, size int64, year int) ([]companyreport.Listing, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	financial, err := readFinancial(zr, year)
	if err != nil {
		return nil, err
	}

	return readSecurities(zr, year, financial)
}

// readSecurities keeps the securities traded on the exchange.
func readSecurities(
	zr *zip.Reader,
	year int,
	financial map[string]bool,
) ([]companyreport.Listing, error) {
	required := []string{
		"CNPJ_Companhia", "Versao", "Nome_Empresarial", "Codigo_Negociacao", "Mercado",
		"Data_Fim_Negociacao", "Valor_Mobiliario", "Composicao_BDR_Unit",
	}
	newest := map[string]int{}

	var rows []listed

	err := readMember(
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

			code := tradingCode(r, id)
			if r.get("Mercado") != "Bolsa" || r.get("Data_Fim_Negociacao") != "" ||
				code == "" {
				return
			}

			rows = append(rows, listed{version, companyreport.Listing{
				Exchange:      exchange,
				Code:          code,
				Identifier:    id,
				Name:          r.get("Nome_Empresarial"),
				SharesPerUnit: sharesPerUnit(r),
				Financial:     financial[id],
			}})
		},
	)
	if err != nil {
		return nil, err
	}

	return pick(rows, newest), nil
}

// readFinancial holds the identifiers of the companies whose newest version names a financial
// sector.
func readFinancial(zr *zip.Reader, year int) (map[string]bool, error) {
	out := map[string]bool{}
	newest := map[string]int{}

	err := readMember(
		zr,
		"fca_cia_aberta_geral_"+strconv.Itoa(year)+".csv",
		[]string{"CNPJ_Companhia", "Versao", "Setor_Atividade"},
		func(r record) {
			id := identifierReplacer.Replace(r.get("CNPJ_Companhia"))

			version, err := strconv.Atoi(r.get("Versao"))
			if err != nil || version < newest[id] {
				return
			}

			sector := strings.TrimPrefix(r.get("Setor_Atividade"), holdingPrefix)
			newest[id] = version
			out[id] = slices.Contains(financialSectors, sector)
		},
	)

	return out, err
}

// tradingCode is the code the row states, else the one the exchange gives the company; "" without
// either (CR4).
func tradingCode(r record, identifier string) string {
	code := strings.ToUpper(r.get("Codigo_Negociacao"))
	if codePattern.MatchString(code) {
		return code
	}

	return exchangeCodes[identifier]
}

// sharesPerUnit sums the numbers of the composition of a unit; nil when it names none or the sum
// passes the limit. A security that is not a unit is one share.
func sharesPerUnit(r record) *int {
	shares := 1

	if r.get("Valor_Mobiliario") == unitSecurity {
		shares = 0

		for _, part := range unitPart.FindAllStringSubmatch(r.get("Composicao_BDR_Unit"), -1) {
			n, err := strconv.Atoi(part[1])
			if err != nil {
				return nil
			}

			shares += n
		}
	}

	return pointerIf(shares >= 1 && shares <= maxUnitsShares, shares)
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
