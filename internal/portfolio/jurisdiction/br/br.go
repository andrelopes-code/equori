// Package br is the Brazilian tax jurisdiction of the Portfolio module.
package br

import (
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const bvmf = "BVMF"

// fgc is the Fundo Garantidor de Créditos guarantee. Source: Resolução CMN 4.222/2013, annex II
// (regulation of the FGC), art. 2 and its paragraphs 2 and 3: R$ 250,000.00 per holder per
// institution or financial conglomerate, R$ 1,000,000.00 per holder over four consecutive
// years, and the covered instruments (time deposits, which hold the CDB and the RDB, and the
// letters LC, LH, LCI, LCA and LCD). Read on 2026-11-17 in the FGC regulation of 2026-06-03
// (fgc.org.br/normas), the compiled text that carries the four-year limit and the LCD; the BCB
// original of 2013 (bcb.gov.br, res_4222_v1_O) confirms the R$ 250,000.00 and the other letters.
// A Tesouro Direto security is federal public debt, issued and paid by the Tesouro Nacional
// (Lei 10.179/2001, art. 1 and 2): the FGC does not cover it and it carries no bank credit.
var fgc = domain.NewGuarantee(
	"FGC",
	brl(25000000),
	brl(100000000),
	4,
	"cdb", "rdb", "lc", "lh", "lci", "lca", "lcd",
).WithSovereign("tesouro")

type Jurisdiction struct{}

func New() Jurisdiction { return Jurisdiction{} }

func (Jurisdiction) ID() string { return "br" }

// TaxYear is the calendar year.
func (Jurisdiction) TaxYear(year int) (time.Time, time.Time) { return domain.CalendarYear(year) }

func (Jurisdiction) Guarantee() (domain.Guarantee, bool) { return fgc, true }

// UnitTax is the come-cotas of the open funds: Lei 14.754/2023, art. 17 to 19.
func (Jurisdiction) UnitTax() (domain.UnitTax, bool) {
	return domain.UnitTax{
		Calendar: "br_banking",
		Months:   []time.Month{time.May, time.November},
		Subtypes: []string{"fixed_income_fund", "multimarket"},
	}, true
}

func (Jurisdiction) IncomeTypes() []string { return []string{"jcp"} }

// subtypeClass maps the subtypes of an instrument type to the tax class they have for an
// individual: the interest of the incentivized fixed income securities is exempt (Lei 11.033/2004
// art. 3 and Lei 12.431/2011 art. 1). A letter of exchange, a financial letter and a common
// debenture are taxed like a CDB (Lei 11.033/2004 art. 1). The LH, the LCD and the CDCA are
// incentivized like the LCI and the LCA; a LIG is taxed like a CDB.
var subtypeClass = map[string]map[string]string{
	"fixed_income": {
		"cdb": "fixed_income", "rdb": "fixed_income", "tesouro": "fixed_income",
		"lc": "fixed_income", "lf": "fixed_income", "debenture": "fixed_income",
		"lig": "fixed_income", "lh": "fixed_income_exempt", "lcd": "fixed_income_exempt",
		"cdca": "fixed_income_exempt",
		"lci":  "fixed_income_exempt", "lca": "fixed_income_exempt", "cri": "fixed_income_exempt",
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
	case "dividend", "bonus_shares":
		return "exempt"
	case "interest", "coupon":
		if taxClass == "fixed_income_exempt" {
			return "exempt"
		}

		return "exclusive"
	case "distribution":
		// A distribution of a listed FII is exempt for an individual (Lei 11.033/2004 art. 3).
		if taxClass == "fii" {
			return "exempt"
		}

		return "exclusive"
	case "jcp":
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

func brl(minor int64) money.Money {
	m, err := money.New(minor, "BRL")
	if err != nil {
		panic(err)
	}

	return m
}
