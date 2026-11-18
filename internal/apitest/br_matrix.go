package apitest

// BRProduct is one row of the Brazilian product matrix (assistant parity design, section 5.1):
// a product, its terms, the primary source of its expected values and a worked example.
// Amounts are decimal strings in BRL; the expected values come from the published calculation
// the source names (M3), never from equori alone.
type BRProduct struct {
	ID, Name, Subtype string

	// Source names the norm or methodology, its article or section, the URL and the date read.
	Source string

	// Contract holds the terms of a new contract as FixedIncomeContractInput; Args holds the
	// same terms as inputs of record_fixed_income.
	Contract map[string]any
	Args     map[string]any

	AppliedOn, Amount string
	// ValuedOn is the date the position, the tax estimate and the issuer exposure are read.
	ValuedOn string

	// WantIncomeTax and WantNet are empty for a security with no tax estimate.
	// WantIncomeTax and WantNet are empty for a security with no tax estimate.
	WantValue, WantIncomeTax, WantNet string
	// WantExcess is the value of the issuer above the limit of the guarantee, WantUncovered the
	// value of subtypes the guarantee does not cover, WantSovereign the value of federal public debt.
	WantExcess, WantUncovered, WantSovereign string
}

// BRProducts are the rows of the matrix with the verdict supported in
// docs/domain/br-product-coverage.md; a row moves here in the commit that supports it (M7).
func BRProducts() []BRProduct {
	return []BRProduct{
		preFixed("F-02", "CDB prefixado", "cdb", taxed, fgc),
		preFixed("F-06", "RDB prefixado", "rdb", taxed, fgc),
		preFixed("F-09", "Letra de Câmbio prefixada", "lc", taxed, fgc),
		preFixed(
			"F-12",
			"Letra Hipotecária prefixada",
			"lh",
			exempt("Lei 11.033/2004 art. 3, II"),
			fgc,
		),
		preFixed(
			"F-17",
			"CRI prefixado",
			"cri",
			exempt("Lei 11.033/2004 art. 3, II"),
			unguaranteed,
		),
		preFixed(
			"F-18",
			"CDCA prefixado",
			"cdca",
			exempt("Lei 11.033/2004 art. 3, IV"),
			unguaranteed,
		),
	}
}

// ltnExample is the LTN example of the Metodologia de Cálculo of the Tesouro Nacional: at 14.36%
// a year, 753.315323 grows to 1,000.00 in the 532 business days from 2008-05-21 to 2010-07-01.
// A pre-fixed contract of any issuer accrues by the same formula, so the example prices each
// pre-fixed row at 1,000 times the published unit price.
const ltnExample = "Tesouro Nacional, Metodologia de Cálculo dos Títulos Públicos Federais Ofertados " +
	"nos Leilões Primários, LTN example (14.36% a.a., 532 business days from 2008-05-21 to " +
	"2010-07-01, unit price 753.315323 for 1,000.00), cdn.tesouro.gov.br, " +
	"Metodologia de Calculo - 290424.pdf, read 2026-11-18"

// rowTax is the income tax of a row: its source, the tax and the net value on ValuedOn.
type rowTax struct{ source, tax, net string }

// taxed is 15% of the gain of 246,684.68 after 771 days, with no IOF after 30 days.
var taxed = rowTax{
	"income tax 15% above 720 days, Lei 11.033/2004 art. 1, IV, read 2026-11-18",
	"37002.70",
	"962997.30",
}

// exempt is a security whose interest an individual does not pay tax on: no estimate is given,
// since estimate_redemption covers the securities taxed at source.
func exempt(article string) rowTax {
	return rowTax{
		"interest exempt for an individual, " + article + ", read 2026-11-18",
		"",
		"",
	}
}

// rowGuarantee is the issuer exposure of a row on ValuedOn.
type rowGuarantee struct{ excess, uncovered string }

// fgc covers 250,000.00 of the issuer (Resolução CMN 4.222/2013, annex II, art. 2).
var (
	fgc          = rowGuarantee{"750000.00", "0.00"}
	unguaranteed = rowGuarantee{"0.00", "1000000.00"}
)

func preFixed(id, name, subtype string, tax rowTax, g rowGuarantee) BRProduct {
	terms := func(rate string, extra map[string]any) map[string]any {
		m := map[string]any{
			"subtype":     subtype,
			"issuer":      "Banco Matriz",
			"issued_on":   "2008-05-21",
			"matures_on":  "2010-07-01",
			"day_count":   "bus252",
			"calendar_id": "br_banking",
		}
		for k, v := range extra {
			m[k] = v
		}

		return m
	}

	return BRProduct{
		ID:            id,
		Name:          name,
		Subtype:       subtype,
		Source:        ltnExample + "; " + tax.source,
		Contract:      terms("", map[string]any{"spread_bp": 1436}),
		Args:          terms("", map[string]any{"spread": "14.36"}),
		AppliedOn:     "2008-05-21",
		Amount:        "753315.32",
		ValuedOn:      "2010-07-01",
		WantValue:     "1000000.00",
		WantIncomeTax: tax.tax,
		WantNet:       tax.net,
		WantExcess:    g.excess,
		WantUncovered: g.uncovered,
		WantSovereign: "0.00",
	}
}
