package domain

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

func TestGuaranteeCovered(t *testing.T) {
	t.Parallel()

	perIssuer, _ := money.New(25000000, "BRL")
	perPeriod, _ := money.New(100000000, "BRL")
	g := NewGuarantee("FGC", perIssuer, perPeriod, 4, "cdb", "lci")

	if g.Name != "FGC" || g.LimitPerIssuer != perIssuer || g.LimitPerPeriod != perPeriod ||
		g.PeriodYears != 4 {
		t.Errorf("guarantee = %+v", g)
	}

	for subtype, want := range map[string]bool{
		"cdb": true, "lci": true, "lf": false, "debenture": false, "": false,
	} {
		if got := g.Covered(subtype); got != want {
			t.Errorf("Covered(%q) = %v, want %v", subtype, got, want)
		}
	}
}

func TestIssuerKey(t *testing.T) {
	t.Parallel()

	for _, c := range []struct{ name, scheme, id, want string }{
		{"Banco X", "br_cnpj", "11222333000181", "br_cnpj:11222333000181"},
		{" Banco  X ", "", "", textfold.Key(" Banco  X ")},
		{"Banco X", "br_cnpj", "", textfold.Key("Banco X")},
		{"", "", "", ""},
		{"  ", "", "", ""},
	} {
		if got := IssuerKey(c.name, c.scheme, c.id); got != c.want {
			t.Errorf("IssuerKey(%q, %q, %q) = %q, want %q", c.name, c.scheme, c.id, got, c.want)
		}
	}
}
