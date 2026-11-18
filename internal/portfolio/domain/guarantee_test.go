package domain

import (
	"slices"
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

func TestGuaranteeCoveredSubtypes(t *testing.T) {
	t.Parallel()

	m, _ := money.New(1, "BRL")
	g := NewGuarantee("FGC", m, m, 4, "cdb", "lci")

	got := g.CoveredSubtypes()
	got[0] = "x"

	if want := []string{"cdb", "lci"}; !slices.Equal(g.CoveredSubtypes(), want) {
		t.Errorf("CoveredSubtypes() = %v, want %v", g.CoveredSubtypes(), want)
	}
}

func TestGuaranteeSovereign(t *testing.T) {
	t.Parallel()

	m, _ := money.New(1, "BRL")
	g := NewGuarantee("FGC", m, m, 4, "cdb").WithSovereign("tesouro")

	for subtype, want := range map[string]bool{"tesouro": true, "cdb": false, "": false} {
		if got := g.Sovereign(subtype); got != want {
			t.Errorf("Sovereign(%q) = %v, want %v", subtype, got, want)
		}
	}

	if !g.Covered("cdb") || g.Covered("tesouro") {
		t.Errorf("Covered changed: cdb %v, tesouro %v", g.Covered("cdb"), g.Covered("tesouro"))
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
