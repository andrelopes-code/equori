package main

// application is a fixed income contract the persona applied in through the brokerage: the bank paper and the private
// credit a retail investor of the persona's income holds beside the government bonds. Dates are counted in months back
// from today, so the panel of the Portfolio screen always has a maturity and a coupon ahead.
type application struct {
	subtype, issuer, name string
	cents                 int64

	monthsAgo  int // the application falls on the 10th business day of that month
	termMonths int

	index     string // empty for a pre-fixed rate
	percentBP int
	spreadBP  int

	dailyLiquidity bool
	couponEvery    int // months between interest payments; zero pays at maturity
}

// applications predate the records, as the first contributions do: the money came from outside the books. A
// contract on an index is at most 28 months old, so an instance whose feeds began with the first securities of the
// demo holds every rate it accrues on.
var applications = []application{
	{
		subtype:        "cdb",
		issuer:         "Banco Daycoval",
		name:           "CDB Daycoval 110% do CDI",
		cents:          200000,
		monthsAgo:      27,
		termMonths:     60,
		index:          "cdi",
		percentBP:      11000,
		dailyLiquidity: true,
	},
	{
		// Matures next month.
		subtype:    "lca",
		issuer:     "Banco ABC Brasil",
		name:       "LCA ABC Brasil 92% do CDI",
		cents:      150000,
		monthsAgo:  26,
		termMonths: 27,
		index:      "cdi",
		percentBP:  9200,
	},
	{
		// Coupons 22, 16, 10 and 4 months ago; the next one in 2 months.
		subtype:     "debenture_incentivada",
		issuer:      "Eletrobras",
		name:        "Debênture Eletrobras IPCA + 6,30%",
		cents:       150000,
		monthsAgo:   28,
		termMonths:  96,
		index:       "ipca",
		spreadBP:    630,
		couponEvery: 6,
	},
	{
		subtype:    "cdb",
		issuer:     "Banco BMG",
		name:       "CDB BMG 12,60% ao ano",
		cents:      150000,
		monthsAgo:  30,
		termMonths: 36,
		spreadBP:   1260,
	},
	{
		// Matured six months ago: redeemed on the day, with the income tax of a holding above 720 days.
		subtype:    "cdb",
		issuer:     "Banco Pine",
		name:       "CDB Pine 11,80% ao ano",
		cents:      150000,
		monthsAgo:  30,
		termMonths: 24,
		spreadBP:   1180,
	},
	{
		subtype:    "lci",
		issuer:     "Banco Inter",
		name:       "LCI Inter 94% do CDI",
		cents:      150000,
		monthsAgo:  25,
		termMonths: 36,
		index:      "cdi",
		percentBP:  9400,
	},
}
