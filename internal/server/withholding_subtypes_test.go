package server_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/portfolio/jurisdiction/br"
)

// The ledger lists the exempt fixed income subtypes of Brazil for the withholding estimate
// (A235 FS4); the Brazilian jurisdiction of Portfolio classifies the same subtypes. Both must
// agree, so a new subtype cannot be taxed in one place and exempt in the other.
func TestWithholdingFollowsTheTaxClass(t *testing.T) {
	t.Parallel()

	j := br.New()
	for _, subtype := range append(j.Subtypes("fixed_income"), "") {
		class := j.TaxClass("fixed_income", subtype, "")
		_, taxed := ledger.FixedIncomeWithholding("BR", "fixed_income", subtype)

		if want := class == "fixed_income"; taxed != want {
			t.Errorf("subtype %q: class %s, estimate = %v, want %v", subtype, class, taxed, want)
		}
	}
}
