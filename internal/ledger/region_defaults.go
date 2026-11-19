package ledger

import (
	"regexp"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// DefaultBaseCurrency returns the base currency a new book of a region starts with.
func DefaultBaseCurrency(region string) (money.Currency, bool) {
	switch region {
	case "BR":
		return "BRL", true
	}

	return "", false
}

// DefaultForeignChargeBP returns the foreign purchase charge, in basis points, a new card of a region starts with.
func DefaultForeignChargeBP(region string) int {
	switch region {
	case "BR":
		return 350
	}

	return 0
}

// DefaultReserveYieldPercent returns the largest yield, in percent per 30 days, that a sync books
// on a reserved balance in currency (D3, A75); 0 books none and leaves the difference open.
func DefaultReserveYieldPercent(currency money.Currency) int64 {
	switch currency {
	case "BRL":
		// 0.1% per day, above the 0.0644% per day of 140% CDI at 12.3% per year.
		return 3
	}

	return 0
}

// jcpRateChange is the first day of the JCP rate of 17.5% in Brazil (Lei Complementar 224/2025).
var jcpRateChange = time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)

// DefaultWithholdingBP returns the income tax withheld, in basis points, on an income type of a
// region paid on date when none is given (F9; A235 FS1). BR taxes a JCP at 15% up to 2025-12-31
// and at 17.5% from 2026-01-01.
func DefaultWithholdingBP(region, incomeType string, date time.Time) int {
	if region != "BR" || incomeType != "jcp" {
		return 0
	}

	if date.Before(jcpRateChange) {
		return 1500
	}

	return 1750
}

// SeparatesDayTrades reports whether a sale of a book of region separates the day's purchases
// from the earlier stock (A228 IO10; BR: IN RFB 1.585/2015, art. 65).
func SeparatesDayTrades(region string) bool {
	return region == "BR"
}

// CostMethod returns how a sale of an instrument type removes cost in a book of region: the
// oldest lot first for a fixed income security in BR (Tesouro Direto sells by PEPS), the average
// cost of the holding otherwise.
func CostMethod(region, instrumentType string) string {
	if region == "BR" && instrumentType == "fixed_income" {
		return domain.CostFIFO
	}

	return domain.CostAverage
}

// brFixedIncomeWithholding is the withholding on the gain of a taxed fixed income security in
// Brazil: income tax by days since the purchase (Lei 11.033/2004 art. 1) and IOF on the gain of
// a redemption within 30 days (Decreto 6.306/2007 art. 32, the table of days 1 to 29).
var brFixedIncomeWithholding = domain.WithholdingTable{
	IncomeTax: []domain.TaxBand{
		{UpToDays: 180, RateBP: 2250},
		{UpToDays: 360, RateBP: 2000},
		{UpToDays: 720, RateBP: 1750},
		{RateBP: 1500},
	},
	IOF: []int{
		9600, 9300, 9000, 8600, 8300, 8000, 7600, 7300, 7000, 6600,
		6300, 6000, 5600, 5300, 5000, 4600, 4300, 4000, 3600, 3300,
		3000, 2600, 2300, 2000, 1600, 1300, 1000, 600, 300,
	},
}

// brEquityFundWithholding is the withholding on the gain of a redemption of an equity fund in
// Brazil: 15% whatever the days held (Lei 14.754/2023 art. 21) and no IOF (Decreto 6.306/2007
// art. 32 §2; coverage row U-02).
var brEquityFundWithholding = domain.WithholdingTable{IncomeTax: []domain.TaxBand{{RateBP: 1500}}}

// brFlatFunds are the fund subtypes withheld at 15% of the gain at a redemption: an equity fund,
// and a FIP or a FIDC that is an investment entity (Lei 14.754/2023 art. 24 and 26; coverage row
// U-04). shortcut: the IOF of a FIP or a FIDC redeemed within 30 days is not estimated; upgrade
// when a source states it.
var brFlatFunds = []string{"equity_fund", "fip", "fidc_entity"}

// brExemptFixedIncome are the subtypes whose interest is exempt for an individual; it mirrors
// subtypeClass of internal/portfolio/jurisdiction/br, and a server test keeps both equal.
var brExemptFixedIncome = []string{
	"lci", "lca", "cri", "cra", "debenture_incentivada", "lh", "lcd", "cdca", "cpr", "lig",
}

// FixedIncomeWithholding returns the withholding table of a fixed income security of a region
// and whether the security pays tax at source (A235 FS4). Only BR taxes a subtype outside the
// exempt list, and the redemption of a fund of brFlatFunds.
func FixedIncomeWithholding(
	region, instrumentType, subtype string,
) (domain.WithholdingTable, bool) {
	if region == "BR" && instrumentType == "fund" && slices.Contains(brFlatFunds, subtype) {
		return brEquityFundWithholding, true
	}

	if region != "BR" || instrumentType != "fixed_income" ||
		slices.Contains(brExemptFixedIncome, subtype) {
		return domain.WithholdingTable{}, false
	}

	return brFixedIncomeWithholding, true
}

// brCustodyBond is the listing code of a Tesouro bond: its kind and its maturity as YYYYMMDD; it
// mirrors governmentBondCode of internal/marketdata.
var brCustodyBond = regexp.MustCompile(`^(LFT|LTN|NTNF|NTNB|NTNBP|NTNC|RENDA|EDUCA)\.([0-9]{8})$`)

// brIncomeBondWages are the minimum wages a redemption or a receipt of an RendA+ or an Educa+
// keeps free of its custody fee of 0.10% (B3, tariffs of Tesouro Direto, read 2026-11-19).
var brIncomeBondWages = map[string]int64{"RENDA": 6, "EDUCA": 4}

// brMinimumWage is the national minimum wage of each year in cents, by the decree that fixed it;
// a year not listed has no custody estimate of an RendA+ or an Educa+ until its decree is added.
var brMinimumWage = map[int]int64{
	2024: 141200, // Decreto 11.864/2023
	2025: 151800, // Decreto 12.342/2024
	2026: 162100, // Decreto 12.797/2025
}

// brCustodyFrom is the day the custody fee of Tesouro Direto became pro rata, deducted at a sale, a
// coupon or the maturity; brCustodyCharged the last half-yearly charge before it, from which it
// accrues (the charge of 2025-01-02 was not made; B3 and Tesouro Nacional, December 2024).
var (
	brCustodyFrom    = time.Date(2024, time.December, 31, 0, 0, 0, 0, time.UTC)
	brCustodyCharged = time.Date(2024, time.July, 1, 0, 0, 0, 0, time.UTC)
)

// CustodyFee returns the custody fee rule of a security of a region (coverage row T-09). In BR a
// Tesouro bond sold from 2024-12-31 pays B3 0.20% a year of its value, pro rata and deducted at a
// sale, a coupon or the maturity; a Tesouro Selic pays it only on the value above R$ 10,000.00 of
// all the holder's Tesouro Selic (B3, tariffs of Tesouro Direto). An earlier sale, under the
// half-yearly charge, has no estimate. A redemption or a receipt of an RendA+ or an Educa+ before
// its maturity pays 0.10% of its amount above 6 or 4 minimum wages of its year.
func CustodyFee(region, instrumentType, subtype, code string) (domain.CustodyRule, bool) {
	match := brCustodyBond.FindStringSubmatch(code)
	if region != "BR" || instrumentType != "fixed_income" || subtype != "tesouro" || match == nil {
		return domain.CustodyRule{}, false
	}

	maturity, err := time.Parse("20060102", match[2])
	if wages, ok := brIncomeBondWages[match[1]]; ok && err == nil {
		return domain.CustodyRule{
			ReceiptBP: 10,
			HeldTo:    maturity,
			ReceiptExempt: func(date time.Time) (int64, bool) {
				wage, ok := brMinimumWage[date.Year()]

				return wages * wage, ok
			},
		}, true
	}

	rule := domain.CustodyRule{RateBP: 20, From: brCustodyFrom}
	if match[1] == "LFT" {
		// The exemption is per holder: it counts all of the holder's Tesouro Selic.
		rule.ExemptMinor = 1000000
		rule.Pooled = func(code string) bool {
			m := brCustodyBond.FindStringSubmatch(code)

			return m != nil && m[1] == "LFT"
		}
	}

	coupons := err == nil && (match[1] == "NTNF" || match[1] == "NTNB" || match[1] == "NTNC")

	rule.PaidTo = func(date time.Time) time.Time {
		if coupons {
			if c := lastCoupon(maturity, date); c.After(brCustodyCharged) {
				return c
			}
		}

		return brCustodyCharged
	}

	return rule, true
}

// lastCoupon is the latest half-yearly coupon date of a bond maturing on maturity before date.
func lastCoupon(maturity, date time.Time) time.Time {
	d := maturity
	for !d.Before(date) {
		d = d.AddDate(0, -6, 0)
	}

	return d
}
