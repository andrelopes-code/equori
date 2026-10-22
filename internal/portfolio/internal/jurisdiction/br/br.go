// Package br is the Brazilian tax jurisdiction of the Portfolio module.
package br

const bvmf = "BVMF"

type Jurisdiction struct{}

func New() Jurisdiction { return Jurisdiction{} }

func (Jurisdiction) ID() string { return "br" }

func (Jurisdiction) IncomeTypes() []string { return []string{"jcp"} }

func (Jurisdiction) TaxClass(instrumentType, exchange string) string {
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

func (Jurisdiction) Treatment(incomeType string) string {
	switch incomeType {
	case "dividend":
		return "exempt"
	case "jcp", "interest", "coupon", "distribution":
		return "exclusive"
	}
	return ""
}
