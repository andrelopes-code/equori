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

// account is a figure of a report that a line of a statement gives (CR5).
type account int

const (
	totalAssets account = iota
	currentAssets
	cash
	shortInvestments
	currentLiabilities
	shortDebt
	longDebt
	equity
	revenue
	grossProfit
	netIncome
	operatingCashFlow
	accountCount
)

const standardCurrentAssets = "Ativo Circulante"

// fixedLines names the accounts of a statement kind by the code of their line.
var fixedLines = map[[2]string]account{
	{"BPA", "1"}:       totalAssets,
	{"BPA", "1.01"}:    currentAssets,
	{"BPA", "1.01.01"}: cash,
	{"BPA", "1.01.02"}: shortInvestments,
	{"BPP", "2.01"}:    currentLiabilities,
	{"BPP", "2.01.04"}: shortDebt,
	{"BPP", "2.02.01"}: longDebt,
	{"DRE", "3.01"}:    revenue,
	{"DRE", "3.03"}:    grossProfit,
	{"DFC_MI", "6.01"}: operatingCashFlow,
	{"DFC_MD", "6.01"}: operatingCashFlow,
}

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

	capitals, err := readCapital(zr, base+"composicao_capital_"+year+".csv")
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

// accountOf returns the account a line of a statement kind gives: a fixed line, or the level-two
// line the description of the equity and the net income names.
func accountOf(kind, code, description string) (account, bool) {
	if a, ok := fixedLines[[2]string{kind, code}]; ok {
		return a, true
	}

	if strings.Count(code, ".") != 1 {
		return 0, false
	}

	switch {
	case kind == "BPP" && strings.HasPrefix(description, "Patrimônio Líquido"):
		return equity, true
	case kind == "DRE" && strings.Contains(description, "Lucro") &&
		strings.Contains(description, "Período"):
		return netIncome, true
	}

	return 0, false
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

		rep := companyreport.Report{
			Identifier:     k.identifier,
			Period:         k.ref,
			Months:         st.months(),
			Name:           f.name,
			Consolidated:   isConsolidated,
			Plan:           st.plan(),
			Delivered:      f.delivered,
			SharesIssued:   capitals[k].issued,
			SharesTreasury: capitals[k].treasury,
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

// months counts the months from the start of the income statement to its end.
func (st *statement) months() int {
	return (st.fim.Year()*12 + int(st.fim.Month())) - (st.ini.Year()*12 + int(st.ini.Month())) + 1
}

func (st *statement) plan() string {
	if st.currentAssets == standardCurrentAssets {
		return "standard"
	}

	return "other"
}

// standardOnly is true for the accounts the chart of accounts "other" does not hold (CR5).
func (a account) standardOnly() bool {
	return a != totalAssets && a != equity && a != netIncome && a != operatingCashFlow
}

// slot is the field of rep that holds account a.
func slot(rep *companyreport.Report, a account) **int64 {
	return [accountCount]**int64{
		totalAssets:        &rep.TotalAssets,
		currentAssets:      &rep.CurrentAssets,
		cash:               &rep.Cash,
		shortInvestments:   &rep.ShortInvestments,
		currentLiabilities: &rep.CurrentLiabilities,
		shortDebt:          &rep.ShortDebt,
		longDebt:           &rep.LongDebt,
		equity:             &rep.Equity,
		revenue:            &rep.Revenue,
		grossProfit:        &rep.GrossProfit,
		netIncome:          &rep.NetIncome,
		operatingCashFlow:  &rep.OperatingCashFlow,
	}[a]
}

func compareReports(a, b companyreport.Report) int {
	return cmp.Or(
		strings.Compare(a.Identifier, b.Identifier),
		a.Period.Compare(b.Period),
		cmp.Compare(a.Months, b.Months),
	)
}
