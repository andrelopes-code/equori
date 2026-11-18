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

	WantValue, WantIncomeTax, WantNet string
	// WantExcess is the value of the issuer above the limit of the guarantee; WantSovereign the
	// value of federal public debt.
	WantExcess, WantSovereign string
}

// BRProducts are the rows of the matrix with the verdict supported in
// docs/domain/br-product-coverage.md; a row moves here in the commit that supports it (M7).
func BRProducts() []BRProduct {
	return []BRProduct{
		{
			ID:      "F-02",
			Name:    "CDB prefixado",
			Subtype: "cdb",
			Source: "Tesouro Nacional, Metodologia de Cálculo dos Títulos Públicos Federais Ofertados " +
				"nos Leilões Primários, LTN example (rate 14.36% a.a., 532 business days from " +
				"2008-05-21 to 2010-07-01, unit price 753.315323 for 1,000.00), " +
				"cdn.tesouro.gov.br/.../Metodologia de Calculo - 290424.pdf, read 2026-11-18; " +
				"income tax 15% above 720 days, Lei 11.033/2004 art. 1, IV, read 2026-11-18",
			Contract: map[string]any{
				"subtype":     "cdb",
				"issuer":      "Banco Matriz",
				"issued_on":   "2008-05-21",
				"matures_on":  "2010-07-01",
				"spread_bp":   1436,
				"day_count":   "bus252",
				"calendar_id": "br_banking",
			},
			Args: map[string]any{
				"subtype":     "cdb",
				"issuer":      "Banco Matriz",
				"issued_on":   "2008-05-21",
				"matures_on":  "2010-07-01",
				"spread":      "14.36",
				"day_count":   "bus252",
				"calendar_id": "br_banking",
			},
			// 1,000 times the published unit price: the published price of 753.315323 grows to
			// 1,000.00 in 532 business days at 14.36%.
			AppliedOn: "2008-05-21",
			Amount:    "753315.32",
			ValuedOn:  "2010-07-01",
			WantValue: "1000000.00",
			// 15% of the gain of 246,684.68 (771 days held), and no IOF after 30 days.
			WantIncomeTax: "37002.70",
			WantNet:       "962997.30",
			// The FGC covers 250,000.00 of the issuer (Resolução CMN 4.222/2013, annex II, art. 2).
			WantExcess:    "750000.00",
			WantSovereign: "0.00",
		},
	}
}
