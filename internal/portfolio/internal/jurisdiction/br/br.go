// Package br is the Brazilian tax jurisdiction of the Portfolio module.
package br

import (
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

const bvmf = "BVMF"

type Jurisdiction struct{}

func New() Jurisdiction { return Jurisdiction{} }

func (Jurisdiction) ID() string { return "br" }

// TaxYear is the calendar year.
func (Jurisdiction) TaxYear(year int) (time.Time, time.Time) { return domain.CalendarYear(year) }

func (Jurisdiction) IncomeTypes() []string { return []string{"jcp"} }

// subtypeClass maps the subtypes of an instrument type to the tax class they have for an
// individual: the interest of the incentivized fixed income securities is exempt (Lei 11.033/2004
// art. 3 and Lei 12.431/2011 art. 1).
var subtypeClass = map[string]map[string]string{
	"fixed_income": {
		"cdb": "fixed_income", "rdb": "fixed_income", "tesouro": "fixed_income",
		"lci": "fixed_income_exempt", "lca": "fixed_income_exempt", "cri": "fixed_income_exempt",
		"cra": "fixed_income_exempt", "debenture_incentivada": "fixed_income_exempt",
	},
	"fund": {
		"fixed_income_fund": "fund", "multimarket": "fund", "equity_fund": "fund_equity",
	},
}

func (Jurisdiction) TaxClass(instrumentType, subtype, exchange string) string {
	if class, ok := subtypeClass[instrumentType][subtype]; ok {
		return class
	}
	if exchange == bvmf {
		switch instrumentType {
		case "reit":
			return "fii"
		case "depositary_receipt":
			return "bdr"
		}
	}
	return instrumentType
}

func (Jurisdiction) Treatment(incomeType, taxClass string) string {
	switch incomeType {
	case "dividend":
		return "exempt"
	case "interest", "coupon":
		if taxClass == "fixed_income_exempt" {
			return "exempt"
		}
		return "exclusive"
	case "jcp", "distribution":
		return "exclusive"
	}
	return ""
}

func (Jurisdiction) Subtypes(instrumentType string) []string {
	subtypes := make([]string, 0, len(subtypeClass[instrumentType]))
	for subtype := range subtypeClass[instrumentType] {
		subtypes = append(subtypes, subtype)
	}
	slices.Sort(subtypes)
	return subtypes
}
