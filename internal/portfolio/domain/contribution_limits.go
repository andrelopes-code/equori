package domain

import (
	"fmt"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	reasonMissing        = "missing"
	reasonShortHistory   = "short_history"
	reasonLoss           = "loss"
	reasonNegativeEquity = "negative_equity"
	reasonChart          = "chart"

	// NoReport is the reason of a member without a company report (AC14).
	NoReport = "no_report"

	figureDecimals   = 6
	yearsCounted     = 5
	growthFact       = "revenue_growth_min"
	yearsFact        = "positive_years_min"
	greatestMultiple = 1000
	greatestRate     = 10
	greatestRatio    = 100
)

// Criterion is a figure of a company as a limit reads it: its value with the end of what it reads,
// or the reason it has none.
type Criterion struct {
	Value  *big.Rat
	Reason string
	Date   time.Time
}

// Growth is the growth of the revenue and its terms, Years years apart.
type Growth struct {
	Criterion

	First, Last *int64
	Years       int
}

// CompanyCriteria holds the figures of a company by the key of the limit that reads them.
type CompanyCriteria struct {
	Figures map[string]Criterion
	Growth  Growth

	// PositiveYears counts the fiscal years with a profit among FiscalYears, at most five.
	PositiveYears, FiscalYears int
	YearsEnd                   time.Time
}

// FactDetail is what an answer of the filings read (AC14).
type FactDetail struct {
	Value  string
	Reason string
	Date   *time.Time
}

// limitRule is a criterion with a limit (AC10): atMost when the figure must not pass it.
type limitRule struct {
	least, greatest *big.Rat
	atMost, whole   bool
}

var (
	leastMultiple = big.NewRat(1, 100)

	limitPattern = regexp.MustCompile(`^-?[0-9]{1,4}(\.[0-9]{1,4})?$`)

	limitCatalog = map[string]limitRule{
		"price_earnings_max":      atMost(leastMultiple, greatestMultiple),
		"price_book_max":          atMost(leastMultiple, greatestMultiple),
		"net_debt_equity_max":     atMost(big.NewRat(-greatestRate, 1), greatestRatio),
		"roe_min":                 atLeast(big.NewRat(-1, 1), greatestRate),
		"net_margin_min":          atLeast(big.NewRat(-1, 1), greatestRate),
		"gross_profit_assets_min": atLeast(big.NewRat(-1, 1), greatestRate),
		"current_ratio_min":       atLeast(leastMultiple, greatestRatio),
		growthFact:                atLeast(big.NewRat(-1, 1), greatestRate),
		yearsFact: {
			least: big.NewRat(1, 1), greatest: big.NewRat(yearsCounted, 1), whole: true,
		},
	}
)

// HasLimit reports whether the fact of a key compares a figure with a limit.
func HasLimit(key string) bool {
	_, ok := limitCatalog[key]

	return ok
}

// Limit answers the criterion of key against limit, a limit cleanLimits accepts (AC12).
func (f CompanyFacts) Limit(key, limit string) (FactAnswer, FactDetail) {
	bound, ok := new(big.Rat).SetString(limit)
	if !ok {
		return FactNone, FactDetail{Reason: reasonMissing}
	}

	switch key {
	case growthFact:
		return f.Criteria.Growth.answer(bound)
	case yearsFact:
		return f.Criteria.years(bound)
	}

	c, ok := f.Criteria.Figures[key]
	if !ok {
		c.Reason = reasonMissing
	}

	if c.Value == nil {
		return c.absent()
	}

	order := c.Value.Cmp(bound)

	return answer(order == 0 || (order < 0) == limitCatalog[key].atMost), c.detail()
}

// absent is the answer of a figure without a value: a company at a loss or without equity does not
// meet a criterion on them (AC12).
func (c Criterion) absent() (FactAnswer, FactDetail) {
	if c.Reason == reasonLoss || c.Reason == reasonNegativeEquity {
		return FactNo, FactDetail{Reason: c.Reason}
	}

	return FactNone, FactDetail{Reason: c.Reason}
}

func (c Criterion) detail() FactDetail {
	return FactDetail{Value: decimalText(c.Value), Date: &c.Date}
}

// answer compares (1 + limit)^years times the first revenue with the last one.
func (g Growth) answer(limit *big.Rat) (FactAnswer, FactDetail) {
	if g.First == nil || g.Last == nil || g.Value == nil {
		return g.absent()
	}

	factor := new(big.Rat).Add(limit, big.NewRat(1, 1))
	needed := new(big.Rat).SetInt64(*g.First)

	for range g.Years {
		needed.Mul(needed, factor)
	}

	return answer(needed.Cmp(new(big.Rat).SetInt64(*g.Last)) <= 0), g.detail()
}

// years answers the count of the years with a profit; the years the history lacks may hold one.
func (c CompanyCriteria) years(limit *big.Rat) (FactAnswer, FactDetail) {
	reached := big.NewRat(int64(c.PositiveYears), 1)
	reachable := big.NewRat(int64(c.PositiveYears+yearsCounted-c.FiscalYears), 1)

	if c.FiscalYears == 0 || reached.Cmp(limit) < 0 && reachable.Cmp(limit) >= 0 {
		return FactNone, FactDetail{Reason: reasonShortHistory}
	}

	return answer(reached.Cmp(limit) >= 0), FactDetail{
		Value: strconv.Itoa(c.PositiveYears),
		Date:  &c.YearsEnd,
	}
}

// SignalDetail is the detail of the signal of key: the reason it has no answer, if any.
func (f CompanyFacts) SignalDetail(key string, a FactAnswer) FactDetail {
	switch {
	case a != FactNone:
		return FactDetail{}
	case !f.applies(key):
		return FactDetail{Reason: reasonChart}
	case len(f.Years) < minSignalYears:
		return FactDetail{Reason: reasonShortHistory}
	}

	return FactDetail{Reason: reasonMissing}
}

// cleanLimits checks AC11 against the facts of the questions and returns one limit per question,
// without trailing zeros, "" for a question without one.
func cleanLimits(raw, facts []string) ([]string, error) {
	out := make([]string, len(facts))

	if len(raw) != 0 && len(raw) != len(facts) {
		return nil, fmt.Errorf(
			"%w: %d limits for %d questions",
			ErrQuestionInvalid,
			len(raw),
			len(facts),
		)
	}

	for i, fact := range facts {
		text := ""
		if len(raw) > 0 {
			text = raw[i]
		}

		limit, err := cleanLimit(text, fact)
		if err != nil {
			return nil, fmt.Errorf("limit %d: %w", i+1, err)
		}

		out[i] = limit
	}

	return out, nil
}

func cleanLimit(text, fact string) (string, error) {
	rule, limited := limitCatalog[fact]

	switch {
	case !limited && text == "":
		return "", nil
	case !limited:
		return "", fmt.Errorf("%w: the question takes no limit", ErrQuestionInvalid)
	case !limitPattern.MatchString(text):
		return "", fmt.Errorf("%w: %q is not a limit", ErrQuestionInvalid, text)
	}

	value, ok := new(big.Rat).SetString(text)
	if !ok || value.Cmp(rule.least) < 0 || value.Cmp(rule.greatest) > 0 ||
		rule.whole && !value.IsInt() {
		return "", fmt.Errorf("%w: %s is out of range", ErrQuestionInvalid, text)
	}

	return decimalText(value), nil
}

func atMost(least *big.Rat, greatest int64) limitRule {
	return limitRule{least: least, greatest: big.NewRat(greatest, 1), atMost: true}
}

func atLeast(least *big.Rat, greatest int64) limitRule {
	return limitRule{least: least, greatest: big.NewRat(greatest, 1)}
}

// decimalText writes a ratio with at most six decimals, without trailing zeros.
func decimalText(r *big.Rat) string {
	text := strings.TrimRight(strings.TrimRight(r.FloatString(figureDecimals), "0"), ".")
	if text == "-0" {
		return "0"
	}

	return text
}
