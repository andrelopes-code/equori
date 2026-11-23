package brcvmcia

import (
	"strings"

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
	netIncomeParent
	equityMinority
	accountCount
)

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

// accountOf returns the account a line of a statement kind gives: a fixed line, the level-two line
// the description of the equity and the net income names, or the level-three line of the holders
// of each (AC0).
func accountOf(kind, code, description string) (account, bool) {
	if a, ok := fixedLines[[2]string{kind, code}]; ok {
		return a, true
	}

	switch strings.Count(code, ".") {
	case 1:
		return levelTwo(kind, description)
	case 2:
		return levelThree(kind, description)
	}

	return 0, false
}

func levelTwo(kind, description string) (account, bool) {
	switch {
	case kind == "BPP" && strings.HasPrefix(description, "Patrimônio Líquido"):
		return equity, true
	case kind == "DRE" && strings.Contains(description, "Lucro") &&
		strings.Contains(description, "Período"):
		return netIncome, true
	}

	return 0, false
}

func levelThree(kind, description string) (account, bool) {
	switch {
	case kind == "DRE" && strings.Contains(description, "Empresa Controladora"):
		return netIncomeParent, true
	case kind == "BPP" && strings.Contains(strings.ToLower(description), "não controladores"):
		return equityMinority, true
	}

	return 0, false
}

// standardOnly is true for the accounts the chart of accounts "other" does not hold (CR5).
func (a account) standardOnly() bool {
	switch a {
	case totalAssets, equity, netIncome, operatingCashFlow, netIncomeParent, equityMinority:
		return false
	default:
		return true
	}
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
		netIncomeParent:    &rep.NetIncomeParent,
		equityMinority:     &rep.EquityMinority,
	}[a]
}
