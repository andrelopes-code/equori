package brcvmcia

import (
	"archive/zip"
	"cmp"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
)

// maxMonths is the longest period a report covers: one fiscal year (CR1).
const maxMonths = 12

const standardCurrentAssets = "Ativo Circulante"

// company is a company and a reference date.
type company struct {
	identifier string
	ref        time.Time
}

// entry is the line an account was read from; the earliest start wins, then the higher code.
type entry struct {
	ini   time.Time
	code  string
	value *int64
}

// statement is what one scope (consolidated or individual) gives for a company and reference
// date.
type statement struct {
	lines [accountCount]*entry
	// income is true when the income statement holds a row; ini and fim are those of its row of
	// the earliest start.
	income        bool
	ini, fim      time.Time
	currentAssets string
	perShare      []perShare
}

func readStatements(f *os.File, size int64, a archive) ([]companyreport.Report, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	year := strconv.Itoa(a.year)
	base := a.kind + "_cia_aberta_"

	filings, err := readGeneral(zr, base+year+".csv")
	if err != nil {
		return nil, err
	}

	scopes := map[string]map[company]*statement{"con": {}, "ind": {}}

	for scope, into := range scopes {
		for _, kind := range []string{"BPA", "BPP", "DRE", "DFC_MI", "DFC_MD"} {
			member := base + kind + "_" + scope + "_" + year + ".csv"

			if err := readStatement(zr, member, kind, filings, into); err != nil {
				return nil, err
			}
		}
	}

	capitals, err := readCapital(zr, base+"composicao_capital_"+year+".csv", filings)
	if err != nil {
		return nil, err
	}

	return build(filings, scopes["con"], scopes["ind"], capitals), nil
}

// row is a line of a statement member of the last fiscal period at the filed version.
type row struct {
	key               company
	ini, fim          time.Time
	code, description string
	value             *int64
}

// readStatement keeps, of the rows of the last fiscal period at the highest version of the
// general member, the lines CR5 names.
func readStatement(
	zr *zip.Reader,
	member, kind string,
	filings map[company]filed,
	into map[company]*statement,
) error {
	required := []string{
		"CNPJ_CIA", "DT_REFER", "VERSAO", "ESCALA_MOEDA", "ORDEM_EXERC", "DT_FIM_EXERC",
		"CD_CONTA", "DS_CONTA", "VL_CONTA",
	}
	if kind != "BPA" && kind != "BPP" {
		required = append(required, "DT_INI_EXERC")
	}

	return readMember(zr, member, required, func(r record) {
		rw, ok := parseRow(r, kind != "BPA" && kind != "BPP", filings)
		if !ok {
			return
		}

		st := into[rw.key]
		if st == nil {
			st = &statement{}
			into[rw.key] = st
		}

		if kind == "DRE" && (!st.income || rw.ini.Before(st.ini)) {
			st.income, st.ini, st.fim = true, rw.ini, rw.fim
		}

		if kind == "BPA" && rw.code == "1.01" {
			st.currentAssets = rw.description
		}

		if kind == "DRE" {
			st.keepPerShare(rw.ini, rw.code, r.get("VL_CONTA"))
		}

		if a, ok := accountOf(kind, rw.code, rw.description); ok {
			st.keep(a, entry{rw.ini, rw.code, rw.value})
		}
	})
}

// parseRow returns false for a row of another period, of a version other than the filed one or
// with a date that does not parse. A statement of a period has a start date when flow is true.
func parseRow(r record, flow bool, filings map[company]filed) (row, bool) {
	ref, refErr := time.Parse(time.DateOnly, r.get("DT_REFER"))
	version, versionErr := strconv.Atoi(r.get("VERSAO"))
	fim, fimErr := time.Parse(time.DateOnly, r.get("DT_FIM_EXERC"))
	ini, iniErr := time.Parse(time.DateOnly, r.get("DT_INI_EXERC"))
	key := company{identifierReplacer.Replace(r.get("CNPJ_CIA")), ref}

	if r.get("ORDEM_EXERC") != "ÚLTIMO" || refErr != nil || versionErr != nil || fimErr != nil ||
		flow && iniErr != nil || filings[key].version != version {
		return row{}, false
	}

	return row{
		key:         key,
		ini:         ini,
		fim:         fim,
		code:        r.get("CD_CONTA"),
		description: r.get("DS_CONTA"),
		value:       minorUnits(r.get("VL_CONTA"), r.get("ESCALA_MOEDA")),
	}, true
}

func (st *statement) keep(a account, e entry) {
	old := st.lines[a]
	if old == nil || e.ini.Before(old.ini) || e.ini.Equal(old.ini) && e.code > old.code {
		st.lines[a] = &e
	}
}

// build makes one report of each company and reference date that has an income statement row:
// from the consolidated statements when they have one, else from the individual ones.
func build(
	filings map[company]filed,
	consolidated, individual map[company]*statement,
	capitals map[company]capital,
) []companyreport.Report {
	var out []companyreport.Report

	for k, f := range filings {
		st, isConsolidated := consolidated[k], true
		if st == nil || !st.income {
			st, isConsolidated = individual[k], false
		}

		if st == nil || !st.income {
			continue
		}

		// A span outside one fiscal year (13 months in the DFP of 2021) is no period of CR1.
		months := st.months()
		if months < 1 || months > maxMonths {
			continue
		}

		rep := companyreport.Report{
			Identifier:     k.identifier,
			Period:         k.ref,
			Months:         months,
			Name:           f.name,
			Consolidated:   isConsolidated,
			Plan:           st.plan(),
			Delivered:      f.delivered,
			SharesIssued:   capitals[k].issued,
			SharesTreasury: capitals[k].treasury,
			ClassesDiffer:  st.classesDiffer(capitals[k]),
		}

		for a := range accountCount {
			if e := st.lines[a]; e != nil && (rep.Plan == "standard" || !a.standardOnly()) {
				*slot(&rep, a) = e.value
			}
		}

		out = append(out, rep)
	}

	slices.SortFunc(out, compareReports)

	return out
}

// months counts the whole months from the start of the income statement to the day after its
// end: 2020-03-31 to 2021-03-31 is 12, 2025-02-26 to 2025-12-31 is 10.
func (st *statement) months() int {
	end := st.fim.AddDate(0, 0, 1)
	months := (end.Year()*12 + int(end.Month())) - (st.ini.Year()*12 + int(st.ini.Month()))

	if end.Day() < st.ini.Day() {
		months--
	}

	return months
}

func (st *statement) plan() string {
	if st.currentAssets == standardCurrentAssets {
		return "standard"
	}

	return "other"
}

func compareReports(a, b companyreport.Report) int {
	return cmp.Or(
		strings.Compare(a.Identifier, b.Identifier),
		a.Period.Compare(b.Period),
		cmp.Compare(a.Months, b.Months),
	)
}
