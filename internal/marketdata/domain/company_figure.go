package domain

import (
	"math/big"
	"strings"
	"time"
)

// The reasons a figure has no value (contribution criteria AC9).
const (
	ReasonChart          = "chart"
	ReasonMissing        = "missing"
	ReasonShortHistory   = "short_history"
	ReasonStale          = "stale"
	ReasonNegativeEquity = "negative_equity"
	ReasonLoss           = "loss"
	ReasonShares         = "shares"
	ReasonClasses        = "classes"
	ReasonUnit           = "unit"
	ReasonParentIncome   = "parent_income"
	ReasonNoPrice        = "no_price"
	ReasonPriceJump      = "price_jump"
)

// The states of a change (AC8).
const (
	ChangeRate   = "rate"
	ChangeLoss   = "loss"
	ChangeTurned = "turned"
)

const (
	standardChart    = "standard"
	fiscalYearMonths = 12
	maxFiscalYears   = 5
	minGrowthYears   = 4
	maxBalanceAge    = 200
	figureDecimals   = 6
	percentRat       = 100
)

// Figure is a ratio of a company: Value with the end of the window or of the balance it reads, or
// the reason it has none.
type Figure struct {
	Value  *big.Rat
	Reason string
	Date   time.Time
}

// Change compares an account with the same months of the year before (AC8). Rate is set in the
// state rate; Reason is set without a comparison.
type Change struct {
	State  string
	Rate   *big.Rat
	Date   time.Time
	Months int
	Reason string
}

// Range is the least and the greatest value of a multiple over Years fiscal years (AC7).
type Range struct {
	Least, Greatest *big.Rat
	Years           int
}

// Growth holds the terms of the growth of the revenue: First and Last are Years years apart.
type Growth struct {
	First, Last *int64
	Years       int
}

// PositiveYears counts the fiscal years with a net income above zero among Years, at most five.
type PositiveYears struct {
	Positive, Years int
}

// CompanyPrice is the chosen price of a date in units of the report's currency.
type CompanyPrice struct {
	Date  time.Time
	Value *big.Rat
}

// FigureInput is what the figures of one company read.
type FigureInput struct {
	Report CompanyReport
	Today  time.Time
	// PriceDate is the date the multiples are asked for.
	PriceDate time.Time
	// Prices are the chosen prices up to PriceDate, oldest first.
	Prices []CompanyPrice
	// YearPrices holds the official price of each fiscal year end that has one (AC7).
	YearPrices   map[time.Time]*big.Rat
	MinorPerUnit int64
}

// CompanyFigures are the figures of AC4 to AC9.
type CompanyFigures struct {
	PriceEarnings, PriceBook           Figure
	PriceEarningsRange, PriceBookRange *Range
	// PriceDate is the date of the price the multiples read; nil without one.
	PriceDate *time.Time

	ReturnOnEquity      Figure
	NetMargin           Figure
	NetDebtToEquity     Figure
	GrossProfitToAssets Figure
	CurrentRatio        Figure
	RevenueGrowth       Figure
	Growth              Growth
	PositiveYears       PositiveYears
	Profit, Revenue     Change
}

// CompanyFigureSet is the figures of one company report set.
type CompanyFigureSet struct {
	Report  CompanyReport
	Figures CompanyFigures
}

// FigureText writes a ratio with at most six decimals, without trailing zeros.
func FigureText(r *big.Rat) string {
	text := r.FloatString(figureDecimals)
	text = strings.TrimRight(strings.TrimRight(text, "0"), ".")

	if text == "-0" {
		return "0"
	}

	return text
}
