package domain

import (
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// Guarantee is a deposit guarantee of a jurisdiction (A236 FC22).
type Guarantee struct {
	Name           string
	LimitPerIssuer money.Money
	LimitPerPeriod money.Money
	PeriodYears    int
	covered        []string
	sovereign      []string
}

func NewGuarantee(
	name string,
	perIssuer, perPeriod money.Money,
	years int,
	covered ...string,
) Guarantee {
	return Guarantee{
		Name:           name,
		LimitPerIssuer: perIssuer,
		LimitPerPeriod: perPeriod,
		PeriodYears:    years,
		covered:        slices.Clone(covered),
	}
}

// WithSovereign names the subtypes the state of the jurisdiction issues: the guarantee does not
// cover them and they are not credit of a private issuer.
func (g Guarantee) WithSovereign(subtypes ...string) Guarantee {
	g.sovereign = slices.Clone(subtypes)

	return g
}

// Covered reports whether the guarantee covers a security of subtype.
func (g Guarantee) Covered(subtype string) bool { return slices.Contains(g.covered, subtype) }

// Sovereign reports whether the state of the jurisdiction issues a security of subtype.
func (g Guarantee) Sovereign(subtype string) bool { return slices.Contains(g.sovereign, subtype) }

// CoveredSubtypes lists the subtypes the guarantee covers, in declaration order.
func (g Guarantee) CoveredSubtypes() []string { return slices.Clone(g.covered) }

// IssuerKey groups the holdings of one issuer (A236 FC3): the identifier of the issuer when
// both parts are set, else the folded name, else "".
func IssuerKey(name, scheme, id string) string {
	if scheme != "" && id != "" {
		return scheme + ":" + id
	}

	return textfold.Key(name)
}
