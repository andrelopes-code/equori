package br

import "testing"

func TestBR(t *testing.T) {
	t.Parallel()
	j := New()
	for _, c := range []struct{ instrumentType, exchange, want string }{
		{"reit", "BVMF", "fii"},
		{"depositary_receipt", "BVMF", "bdr"},
		{"reit", "XNYS", "reit"},
		{"stock", "BVMF", "stock"},
	} {
		if got := j.TaxClass(c.instrumentType, c.exchange); got != c.want {
			t.Errorf("TaxClass(%q, %q) = %q, want %q", c.instrumentType, c.exchange, got, c.want)
		}
	}
	for incomeType, want := range map[string]string{
		"dividend": "exempt", "jcp": "exclusive", "interest": "exclusive",
		"coupon": "exclusive", "distribution": "exclusive", "other": "",
	} {
		if got := j.Treatment(incomeType); got != want {
			t.Errorf("Treatment(%q) = %q, want %q", incomeType, got, want)
		}
	}
	if j.ID() != "br" || len(j.IncomeTypes()) != 1 || j.IncomeTypes()[0] != "jcp" {
		t.Errorf("ID = %q, IncomeTypes = %v", j.ID(), j.IncomeTypes())
	}
}
