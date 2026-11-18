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

	// Code, Units and UnitPrice name a security bought on AppliedOn, such as a Tesouro Direto
	// bond; Price is its price on ValuedOn. A row with Code is bought, not applied as a contract.
	Code, Units, UnitPrice, Price string

	// CDI is the published daily rate of the CDI (BCB SGS series 12) of each business day the row
	// accrues, as the SGS answers it: date as dd/MM/yyyy and percent a day.
	CDI [][2]string

	AppliedOn, Amount string
	// ValuedOn is the date the position, the tax estimate and the issuer exposure are read.
	ValuedOn string

	// WantIncomeTax and WantNet are empty for a security with no tax estimate.
	// WantIncomeTax and WantNet are empty for a security with no tax estimate.
	WantValue, WantIncomeTax, WantIOF, WantNet string
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
		earlyRedemption(),
		ltn(),
		cdiRow("F-01", "CDB 100% do CDI, liquidez diária", map[string]any{
			"index_id": "cdi", "percent_of_index_bp": 10000, "daily_liquidity": true,
		}, map[string]any{
			"index_id": "cdi", "percent_of_index": "100", "daily_liquidity": true,
		}, "101013.20", "227.97", "100785.23"),
		cdiRow("F-04", "CDB CDI + 1,5%", map[string]any{
			"index_id": "cdi", "percent_of_index_bp": 10000, "spread_bp": 150,
		}, map[string]any{
			"index_id": "cdi", "percent_of_index": "100", "spread": "1.5",
		}, "101144.58", "257.53", "100887.05"),
	}
}

// cdiJanuary2025 is the CDI of the business days of January 2025 and of 2025-02-03 as BCB SGS
// series 12 publishes it (api.bcb.gov.br/dados/serie/bcdata.sgs.12, fetched 2026-11-18). The rate
// of 2025-02-03 accrues to the next day, so it gives the price of 2025-02-03 without entering it.
var cdiJanuary2025 = [][2]string{
	{"02/01/2025", "0.045513"}, {"03/01/2025", "0.045513"}, {"06/01/2025", "0.045513"},
	{"07/01/2025", "0.045513"}, {"08/01/2025", "0.045513"}, {"09/01/2025", "0.045513"},
	{"10/01/2025", "0.045513"}, {"13/01/2025", "0.045513"}, {"14/01/2025", "0.045513"},
	{"15/01/2025", "0.045513"}, {"16/01/2025", "0.045513"}, {"17/01/2025", "0.045513"},
	{"20/01/2025", "0.045513"}, {"21/01/2025", "0.045513"}, {"22/01/2025", "0.045513"},
	{"23/01/2025", "0.045513"}, {"24/01/2025", "0.045513"}, {"27/01/2025", "0.045513"},
	{"28/01/2025", "0.045513"}, {"29/01/2025", "0.045513"}, {"30/01/2025", "0.049037"},
	{"31/01/2025", "0.049037"}, {"03/02/2025", "0.049037"},
}

// cdiRow is a CDB applied on 2025-01-02 and read on 2025-02-03, after the 22 published rates of
// January 2025, from the issue date inclusive (B3, Caderno de Fórmulas of CDBs, 6.1.2). The value is 100,000.00 times the product of 1 + rate × percent of each day, and
// a spread multiplies each day by (1 + spread)^(1/252); computed independently with 80-digit
// decimals. Held 32 days: no IOF, and income tax 22.5% (Lei 11.033/2004 art. 1, I).
func cdiRow(id, name string, contract, args map[string]any, value, tax, net string) BRProduct {
	terms := func(extra map[string]any) map[string]any {
		m := map[string]any{
			"subtype":    "cdb",
			"issuer":     "Banco Matriz",
			"issued_on":  "2025-01-02",
			"matures_on": "2027-01-04",
			"day_count":  "bus252",
		}
		for k, v := range extra {
			m[k] = v
		}

		return m
	}

	return BRProduct{
		ID:      id,
		Name:    name,
		Subtype: "cdb",
		Source: "BCB SGS series 12 (CDI, percent a day), January 2025, fetched 2026-11-18; " +
			"income tax 22.5% up to 180 days, Lei 11.033/2004 art. 1, I, read 2026-11-18",
		Contract:      terms(contract),
		Args:          terms(args),
		CDI:           cdiJanuary2025,
		AppliedOn:     "2025-01-02",
		Amount:        "100000.00",
		ValuedOn:      "2025-02-03",
		WantValue:     value,
		WantIncomeTax: tax,
		WantIOF:       "0.00",
		WantNet:       net,
		WantExcess:    "0.00",
		WantUncovered: "0.00",
		WantSovereign: "0.00",
	}
}

// earlyRedemption is row F-19: the CDB of F-02 read 20 days after the application, 13 business
// days of br_banking (Corpus Christi on 2008-05-22). The value follows the formula of the LTN
// example, computed independently with 80-digit decimals: 758,547.89, a gain of 5,232.57. The IOF
// of day 20 is 33% of the gain (Decreto 6.306/2007, art. 32 and annex, read 2026-11-18), and the
// income tax is 22.5% of the gain less the IOF (Lei 11.033/2004 art. 1, I).
func earlyRedemption() BRProduct {
	row := preFixed("F-19", "CDB prefixado resgatado em 20 dias", "cdb", taxed, fgc)
	row.Source = ltnExample + "; IOF table of Decreto 6.306/2007, art. 32 and annex, read " +
		"2026-11-18; income tax 22.5% up to 180 days, Lei 11.033/2004 art. 1, I"
	row.ValuedOn = "2008-06-10"
	row.WantValue = "758547.89"
	row.WantIOF = "1726.75"
	row.WantIncomeTax = "788.81"
	row.WantNet = "756032.33"
	row.WantExcess = "508547.89"

	return row
}

// ltnExample is the LTN example of the Metodologia de Cálculo of the Tesouro Nacional: at 14.36%
// a year, 753.315323 grows to 1,000.00 in the 532 business days from 2008-05-21 to 2010-07-01.
// A pre-fixed contract of any issuer accrues by the same formula, so the example prices each
// pre-fixed row at 1,000 times the published unit price.
const ltnExample = "Tesouro Nacional, Metodologia de Cálculo dos Títulos Públicos Federais Ofertados " +
	"nos Leilões Primários, LTN example (14.36% a.a., 532 business days from 2008-05-21 to " +
	"2010-07-01, unit price 753.315323 for 1,000.00), cdn.tesouro.gov.br, " +
	"Metodologia de Calculo - 290424.pdf, read 2026-11-18"

// rowTax is the tax of a row: its source, the income tax, the IOF and the net value on ValuedOn.
type rowTax struct{ source, tax, iof, net string }

// taxed is 15% of the gain of 246,684.68 after 771 days, with no IOF after 30 days.
var taxed = rowTax{
	source: "income tax 15% above 720 days, Lei 11.033/2004 art. 1, IV, read 2026-11-18",
	tax:    "37002.70",
	iof:    "0.00",
	net:    "962997.30",
}

// exempt is a security whose interest an individual does not pay tax on: no estimate is given,
// since estimate_redemption covers the securities taxed at source.
func exempt(article string) rowTax {
	return rowTax{source: "interest exempt for an individual, " + article + ", read 2026-11-18"}
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
		WantIOF:       tax.iof,
		WantNet:       tax.net,
		WantExcess:    g.excess,
		WantUncovered: g.uncovered,
		WantSovereign: "0.00",
	}
}

// ltn is row T-02: 1,000 units of the LTN of the example of the Metodologia de Cálculo, bought at
// the published unit price on 2008-05-21 and priced at the face value of 1,000.00 on maturity, as
// the Tesouro Direto prices a pre-fixed bond (Precificação dos títulos públicos: the face value of
// an LTN is always 1,000.00). Federal public debt has no FGC limit (Lei 10.179/2001).
func ltn() BRProduct {
	return BRProduct{
		ID:      "T-02",
		Name:    "Tesouro Prefixado",
		Subtype: "tesouro",
		Source: ltnExample + "; " + taxed.source + "; federal public debt, Lei 10.179/2001 " +
			"art. 1 and 2",
		Code:          "LTN.20100701",
		Units:         "1000.00",
		UnitPrice:     "753.315323",
		Price:         "1000.00",
		AppliedOn:     "2008-05-21",
		ValuedOn:      "2010-07-01",
		WantValue:     "1000000.00",
		WantIncomeTax: taxed.tax,
		WantIOF:       taxed.iof,
		WantNet:       taxed.net,
		WantExcess:    "0.00",
		WantUncovered: "0.00",
		WantSovereign: "1000000.00",
	}
}
