package br

import (
	"slices"
	"testing"
)

func TestBR(t *testing.T) {
	t.Parallel()
	j := New()
	for _, c := range []struct{ instrumentType, subtype, exchange, want string }{
		{"reit", "", "BVMF", "fii"},
		{"depositary_receipt", "", "BVMF", "bdr"},
		{"reit", "", "XNYS", "reit"},
		{"stock", "", "BVMF", "stock"},
		{"fixed_income", "", "", "fixed_income"},
		{"fixed_income", "cdb", "", "fixed_income"},
		{"fixed_income", "cri", "", "fixed_income_exempt"},
		{"fixed_income", "lca", "", "fixed_income_exempt"},
		{"fixed_income", "xyz_bond", "", "fixed_income"},
		{"fund", "equity_fund", "", "fund_equity"},
		{"fund", "multimarket", "", "fund"},
		{"stock", "cri", "BVMF", "stock"},
	} {
		if got := j.TaxClass(c.instrumentType, c.subtype, c.exchange); got != c.want {
			t.Errorf("TaxClass(%q, %q, %q) = %q, want %q", c.instrumentType, c.subtype, c.exchange, got, c.want)
		}
	}
	for incomeType, want := range map[string]string{
		"dividend": "exempt", "jcp": "exclusive", "interest": "exclusive",
		"coupon": "exclusive", "distribution": "exclusive", "other": "",
	} {
		if got := j.Treatment(incomeType, ""); got != want {
			t.Errorf("Treatment(%q) = %q, want %q", incomeType, got, want)
		}
	}
	for _, c := range []struct{ incomeType, taxClass, want string }{
		{"coupon", "fixed_income_exempt", "exempt"},
		{"interest", "fixed_income_exempt", "exempt"},
		{"jcp", "fixed_income_exempt", "exclusive"},
		{"coupon", "fixed_income", "exclusive"},
	} {
		if got := j.Treatment(c.incomeType, c.taxClass); got != c.want {
			t.Errorf("Treatment(%q, %q) = %q, want %q", c.incomeType, c.taxClass, got, c.want)
		}
	}
	if j.ID() != "br" || len(j.IncomeTypes()) != 1 || j.IncomeTypes()[0] != "jcp" {
		t.Errorf("ID = %q, IncomeTypes = %v", j.ID(), j.IncomeTypes())
	}
	if got, want := j.Subtypes("fund"), []string{"equity_fund", "fixed_income_fund", "multimarket"}; !slices.Equal(got, want) {
		t.Errorf("Subtypes(fund) = %v, want %v", got, want)
	}
	if got := j.Subtypes("stock"); len(got) != 0 {
		t.Errorf("Subtypes(stock) = %v, want none", got)
	}
}
