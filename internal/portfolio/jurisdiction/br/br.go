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
//
// The DPGE (depósito a prazo com garantia especial) has the special guarantee of the FGC: up to
// R$ 40,000,000.00 per holder per conglomerate, apart from the ordinary guarantee and its
// four-year ceiling (FGC, material for brokers, December 2025, read 2026-11-18 at fgc.org.br).
var fgc = domain.NewGuarantee(
	"FGC",
	brl(25000000),
	brl(100000000),
	4,
	"cdb", "rdb", "lc", "lh", "lci", "lca", "lcd",
).WithSovereign("tesouro").WithSpecial(brl(4000000000), "dpge")

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
		// A FIDC pays come-cotas unless it is an investment entity (Lei 14.754/2023).
		Subtypes: []string{"fixed_income_fund", "multimarket", "fidc"},
	}, true
}

// IncomeTypes: lending_fee is what the lender of securities receives at B3 (BTC); the holding keeps
// its units (coverage row E-12).
func (Jurisdiction) IncomeTypes() []string { return []string{"jcp", "lending_fee"} }

// DeductibleContributions: the contributions of a PGBL are deducted up to 12% of the taxable
// income of an individual who contributes to the public pension (Lei 9.532/1997, art. 11).
func (Jurisdiction) DeductibleContributions() []string { return []string{"pension_pgbl"} }

// subtypeClass maps the subtypes of an instrument type to the tax class they have for an
// individual: the interest of the incentivized fixed income securities is exempt (Lei 11.033/2004
// art. 3 and Lei 12.431/2011 art. 2, I). A letter of exchange, a financial letter and a common
// debenture are taxed like a CDB (Lei 11.033/2004 art. 1). The LH, the LCD and the CDCA are
// incentivized like the LCI and the LCA, and so is a LIG (Lei 13.097/2015, its chapter on the
// LIG). A CPR with financial settlement is exempt (Lei 11.033/2004 art. 3, V); a commercial note
// (Lei 14.195/2021) and a LAM (Lei 11.882/2008) are taxed like a CDB, and the FGC covers
// neither. A pension plan is the quotas of the fund of its insurer: a PGBL is taxed on the whole
// redemption, a VGBL on its gain (Lei 11.053/2004), by the progressive or the regressive table
// the participant chose.
var subtypeClass = map[string]map[string]string{
	"fixed_income": {
		"cdb":                   "fixed_income",
		"rdb":                   "fixed_income",
		"tesouro":               "fixed_income",
		"lc":                    "fixed_income",
		"lf":                    "fixed_income",
		"debenture":             "fixed_income",
		"lig":                   "fixed_income_exempt",
		"dpge":                  "fixed_income",
		"lam":                   "fixed_income",
		"nota_comercial":        "fixed_income",
		"cpr":                   "fixed_income_exempt",
		"coe":                   "fixed_income",
		"lh":                    "fixed_income_exempt",
		"lcd":                   "fixed_income_exempt",
		"cdca":                  "fixed_income_exempt",
		"lci":                   "fixed_income_exempt",
		"lca":                   "fixed_income_exempt",
		"cri":                   "fixed_income_exempt",
		"cra":                   "fixed_income_exempt",
		"debenture_incentivada": "fixed_income_exempt",
	},
	"fund": {
		"fixed_income_fund": "fund", "multimarket": "fund", "equity_fund": "fund_equity",
		"pgbl": "pension_pgbl", "vgbl": "pension_vgbl",
		// A FI-Infra holds incentivized debentures: its income is exempt for an individual (Lei
		// 12.431/2011 art. 3); a FIDC and a FIP are taxed as funds (Lei 14.754/2023).
		"fi_infra": "fund_exempt", "fidc": "fund", "fip": "fund",
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
		if taxClass == "fii" || taxClass == "fund_exempt" {
			return "exempt"
		}

		return "exclusive"
	case "jcp":
		return "exclusive"
	case "lending_fee":
		// The fee of a securities lending is withheld at source by the table of the fixed
		// income gains (IN RFB 1.585/2015, securities lending).
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
