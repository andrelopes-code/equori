package br

import (
	"slices"
	"testing"
	"time"
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
		{"fixed_income", "lc", "", "fixed_income"},
		{"fixed_income", "lf", "", "fixed_income"},
		{"fixed_income", "lcd", "", "fixed_income_exempt"},
		{"fixed_income", "lh", "", "fixed_income_exempt"},
		{"fixed_income", "cdca", "", "fixed_income_exempt"},
		// Coverage row F-11: the income of a LIG is exempt for an individual (Lei 13.097/2015).
		{"fixed_income", "lig", "", "fixed_income_exempt"},
		{"fixed_income", "dpge", "", "fixed_income"},
		// Coverage row F-18b: a financial CPR is exempt; a commercial note and a LAM are taxed.
		{"fixed_income", "cpr", "", "fixed_income_exempt"},
		{"fixed_income", "nota_comercial", "", "fixed_income"},
		{"fixed_income", "lam", "", "fixed_income"},
		// Coverage rows U-03, U-04 and U-06.
		{"fund", "fi_infra", "", "fund_exempt"},
		// Coverage row E-10: an ETF of fixed income is taxed at source by term (Lei 13.043/2014).
		{"etf", "fixed_income_etf", "BVMF", "etf_fixed_income"},
		{"etf", "", "BVMF", "etf"},
		{"fund", "fidc", "", "fund"},
		{"fund", "fip", "", "fund"},
		{"fixed_income", "coe", "", "fixed_income"},
		{"fixed_income", "debenture", "", "fixed_income"},
		{"fixed_income", "xyz_bond", "", "fixed_income"},
		{"fund", "equity_fund", "", "fund_equity"},
		{"fund", "multimarket", "", "fund"},
		// Coverage row U-05: a PGBL is taxed on the whole redemption, a VGBL on its gain.
		{"fund", "pgbl", "", "pension_pgbl"},
		{"fund", "vgbl", "", "pension_vgbl"},
		{"stock", "cri", "BVMF", "stock"},
	} {
		if got := j.TaxClass(c.instrumentType, c.subtype, c.exchange); got != c.want {
			t.Errorf(
				"TaxClass(%q, %q, %q) = %q, want %q",
				c.instrumentType,
				c.subtype,
				c.exchange,
				got,
				c.want,
			)
		}
	}

	for incomeType, want := range map[string]string{
		"dividend": "exempt", "jcp": "exclusive", "interest": "exclusive",
		"coupon": "exclusive", "distribution": "exclusive", "bonus_shares": "exempt",
		"other": "",
		// Coverage row E-12: the fee of a securities lending is withheld at source like interest.
		"lending_fee": "exclusive",
	} {
		if got := j.Treatment(incomeType, ""); got != want {
			t.Errorf("Treatment(%q) = %q, want %q", incomeType, got, want)
		}
	}

	for _, c := range []struct{ incomeType, taxClass, want string }{
		{"coupon", "fixed_income_exempt", "exempt"},
		{"interest", "fixed_income_exempt", "exempt"},
		{"jcp", "fixed_income_exempt", "exclusive"},
		{"distribution", "fii", "exempt"},
		{"distribution", "fund", "exclusive"},
		{"distribution", "fund_exempt", "exempt"},
		{"distribution", "", "exclusive"},
		{"coupon", "fixed_income", "exclusive"},
	} {
		if got := j.Treatment(c.incomeType, c.taxClass); got != c.want {
			t.Errorf("Treatment(%q, %q) = %q, want %q", c.incomeType, c.taxClass, got, c.want)
		}
	}

	if j.ID() != "br" || !slices.Equal(j.IncomeTypes(), []string{"jcp", "lending_fee"}) {
		t.Errorf("ID = %q, IncomeTypes = %v", j.ID(), j.IncomeTypes())
	}

	if got, want := j.Subtypes(
		"fund",
	), []string{
		"equity_fund",
		"fi_infra",
		"fidc",
		"fip",
		"fixed_income_fund",
		"multimarket",
		"pgbl",
		"short_term_fund",
		"vgbl",
	}; !slices.Equal(
		got,
		want,
	) {
		t.Errorf("Subtypes(fund) = %v, want %v", got, want)
	}

	got := j.Subtypes("fixed_income")
	for _, subtype := range []string{"cdca", "lcd", "lh", "lig"} {
		if !slices.Contains(got, subtype) {
			t.Errorf("Subtypes(fixed_income) = %v, want %q", got, subtype)
		}
	}

	if got := j.Subtypes("stock"); len(got) != 0 {
		t.Errorf("Subtypes(stock) = %v, want none", got)
	}
}

func TestTaxYear(t *testing.T) {
	t.Parallel()

	from, to := New().TaxYear(2026)
	if want := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC); !from.Equal(want) {
		t.Errorf("from = %v, want %v", from, want)
	}

	if want := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC); !to.Equal(want) {
		t.Errorf("to = %v, want %v", to, want)
	}
}

func TestGuarantee(t *testing.T) {
	t.Parallel()

	g, ok := New().Guarantee()
	if !ok {
		t.Fatal("Guarantee() has none")
	}

	if g.Name != "FGC" || g.PeriodYears != 4 {
		t.Errorf("Name = %q, PeriodYears = %d", g.Name, g.PeriodYears)
	}

	if g.LimitPerIssuer.Amount() != 25000000 || g.LimitPerIssuer.Currency() != "BRL" {
		t.Errorf("LimitPerIssuer = %v", g.LimitPerIssuer)
	}

	if g.LimitPerPeriod.Amount() != 100000000 || g.LimitPerPeriod.Currency() != "BRL" {
		t.Errorf("LimitPerPeriod = %v", g.LimitPerPeriod)
	}

	// Coverage row F-13: the DPGE has the special guarantee, apart from the ordinary one.
	if g.SpecialLimit.Amount() != 4000000000 || !g.Special("dpge") || g.Covered("dpge") ||
		g.Special("cdb") {
		t.Errorf("special guarantee = %v %v", g.SpecialLimit, g.SpecialSubtypes())
	}

	for subtype, want := range map[string]bool{
		"cdb": true, "rdb": true, "lc": true, "lh": true, "lci": true, "lca": true, "lcd": true,
		"lf": false, "debenture": false, "lig": false, "cri": false, "lam": false, "cpr": false,
		"nota_comercial": false,
	} {
		if got := g.Covered(subtype); got != want {
			t.Errorf("Covered(%q) = %v, want %v", subtype, got, want)
		}
	}
}

func TestGuaranteeSovereign(t *testing.T) {
	t.Parallel()

	g, _ := New().Guarantee()

	for subtype, want := range map[string]bool{"tesouro": true, "cdb": false, "debenture": false} {
		if got := g.Sovereign(subtype); got != want {
			t.Errorf("Sovereign(%q) = %v, want %v", subtype, got, want)
		}
	}
}

func TestUnitTax(t *testing.T) {
	t.Parallel()

	u, ok := New().UnitTax()
	if !ok {
		t.Fatal("UnitTax() has none")
	}

	if u.Calendar != "br_banking" {
		t.Errorf("Calendar = %q", u.Calendar)
	}

	if !slices.Equal(u.Months, []time.Month{time.May, time.November}) {
		t.Errorf("Months = %v", u.Months)
	}

	want := []string{"fixed_income_fund", "multimarket", "fidc", "short_term_fund"}
	if !slices.Equal(u.Subtypes, want) {
		t.Errorf("Subtypes = %v", u.Subtypes)
	}

	// Coverage row U-01: 15% for a long-term fund, 20% for a short-term one.
	if u.RateBP["fixed_income_fund"] != 1500 || u.RateBP["short_term_fund"] != 2000 {
		t.Errorf("RateBP = %v", u.RateBP)
	}
}

// Coverage row U-05: the contributions of a PGBL are deducted from taxable income (Lei 9.532/1997,
// art. 11), those of a VGBL are not, and no pension plan pays come-cotas.
func TestPensionPlans(t *testing.T) {
	t.Parallel()

	j := New()

	if got := j.DeductibleContributions(); !slices.Equal(got, []string{"pension_pgbl"}) {
		t.Errorf("DeductibleContributions = %v, want [pension_pgbl]", got)
	}

	if got := j.Subtypes("fund"); !slices.Contains(got, "pgbl") || !slices.Contains(got, "vgbl") {
		t.Errorf("Subtypes(fund) = %v, want pgbl and vgbl", got)
	}

	rule, _ := j.UnitTax()
	if slices.Contains(rule.Subtypes, "pgbl") || slices.Contains(rule.Subtypes, "vgbl") {
		t.Errorf("UnitTax subtypes = %v, want no pension plan", rule.Subtypes)
	}
}

// Coverage rows U-03 and U-04: a FIDC pays come-cotas unless it is an investment entity; a FI-Infra
// and a FIP do not (Lei 14.754/2023).
func TestUnitTaxOfClosedFunds(t *testing.T) {
	t.Parallel()

	rule, _ := New().UnitTax()
	if !slices.Contains(rule.Subtypes, "fidc") || slices.Contains(rule.Subtypes, "fi_infra") ||
		slices.Contains(rule.Subtypes, "fip") {
		t.Errorf("UnitTax subtypes = %v, want fidc and not fi_infra or fip", rule.Subtypes)
	}

	g, _ := New().Guarantee()
	if g.Covered("coe") || g.Covered("fi_infra") {
		t.Error("the FGC covers coe or fi_infra, want neither")
	}
}
