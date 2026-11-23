package domain

import (
	"errors"
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestLimitAnswer(t *testing.T) {
	t.Parallel()

	window := time.Date(2026, time.September, 30, 0, 0, 0, 0, time.UTC)
	year := time.Date(2025, time.December, 31, 0, 0, 0, 0, time.UTC)
	x := CompanyFacts{Criteria: CompanyCriteria{
		Figures: map[string]Criterion{
			"price_earnings_max": {Value: ratOf("10"), Date: window},
			"roe_min":            {Value: ratOf("0.23"), Date: window},
			"net_debt_equity_max": {
				Reason: "negative_equity",
			},
			"price_book_max":    {Reason: "shares"},
			"net_margin_min":    {Reason: "loss"},
			"current_ratio_min": {Reason: "chart"},
		},
		Growth: Growth{
			First: amount(64000000), Last: amount(100000000), Years: 4,
			Criterion: Criterion{Value: ratOf("0.118034"), Date: year},
		},
		PositiveYears: 3, FiscalYears: 3, YearsEnd: year,
	}}

	for name, tc := range map[string]struct {
		facts  CompanyFacts
		key    string
		limit  string
		answer FactAnswer
		detail FactDetail
	}{
		"price over earnings at the limit": {
			x, "price_earnings_max", "10", FactYes, FactDetail{Value: "10", Date: &window},
		},
		"price over earnings above the limit": {
			x, "price_earnings_max", "9.9999", FactNo, FactDetail{Value: "10", Date: &window},
		},
		"return at the limit": {
			x, "roe_min", "0.23", FactYes, FactDetail{Value: "0.23", Date: &window},
		},
		"return below the limit": {
			x, "roe_min", "0.2301", FactNo, FactDetail{Value: "0.23", Date: &window},
		},
		"negative equity": {
			x, "net_debt_equity_max", "1", FactNo, FactDetail{Reason: "negative_equity"},
		},
		"loss": {x, "net_margin_min", "-1", FactNo, FactDetail{Reason: "loss"}},
		"shares not verified": {
			x, "price_book_max", "1", FactNone, FactDetail{Reason: "shares"},
		},
		"another chart": {
			x, "current_ratio_min", "1", FactNone, FactDetail{Reason: "chart"},
		},
		"figure absent": {
			x, "gross_profit_assets_min", "0.1", FactNone, FactDetail{Reason: "missing"},
		},
		"growth above the limit": {
			x, "revenue_growth_min", "0.118", FactYes,
			FactDetail{Value: "0.118034", Date: &year},
		},
		"growth below the limit": {
			x, "revenue_growth_min", "0.1181", FactNo,
			FactDetail{Value: "0.118034", Date: &year},
		},
		"growth without terms": {
			CompanyFacts{Criteria: CompanyCriteria{
				Growth: Growth{Criterion: Criterion{Reason: "short_history"}},
			}},
			"revenue_growth_min", "0.1", FactNone, FactDetail{Reason: "short_history"},
		},
		"three of three years, limit three": {
			x, "positive_years_min", "3", FactYes, FactDetail{Value: "3", Date: &year},
		},
		"three of three years, limit four": {
			x, "positive_years_min", "4", FactNone, FactDetail{Reason: "short_history"},
		},
		"one of three years, limit four": {
			withYears(1, 3, year), "positive_years_min", "4", FactNo,
			FactDetail{Value: "1", Date: &year},
		},
		"two of three years, limit four": {
			withYears(2, 3, year), "positive_years_min", "4", FactNone,
			FactDetail{Reason: "short_history"},
		},
		"four of five years, limit five": {
			withYears(4, 5, year), "positive_years_min", "5", FactNo,
			FactDetail{Value: "4", Date: &year},
		},
		"no year": {
			CompanyFacts{}, "positive_years_min", "1", FactNone,
			FactDetail{Reason: "short_history"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			answer, detail := tc.facts.Limit(tc.key, tc.limit)
			if answer != tc.answer || !reflect.DeepEqual(detail, tc.detail) {
				t.Fatalf("answer = %s %+v, want %s %+v", answer, detail, tc.answer, tc.detail)
			}
		})
	}
}

func TestCleanLimits(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		facts, limits []string
		want          []string
		err           error
	}{
		"none":              {[]string{"", ""}, nil, []string{"", ""}, nil},
		"trailing zeros":    {[]string{"roe_min"}, []string{"0.1200"}, []string{"0.12"}, nil},
		"negative":          {[]string{"roe_min"}, []string{"-0.05"}, []string{"-0.05"}, nil},
		"zero":              {[]string{"net_debt_equity_max"}, []string{"0.0"}, []string{"0"}, nil},
		"least":             {[]string{"price_book_max"}, []string{"0.01"}, []string{"0.01"}, nil},
		"greatest":          {[]string{"price_earnings_max"}, []string{"1000"}, []string{"1000"}, nil},
		"years":             {[]string{"positive_years_min"}, []string{"5"}, []string{"5"}, nil},
		"signal and own":    {[]string{"piotroski_p1", ""}, []string{"", ""}, []string{"", ""}, nil},
		"blank":             {[]string{"price_earnings_max"}, []string{""}, nil, ErrQuestionInvalid},
		"absent":            {[]string{"price_earnings_max"}, nil, nil, ErrQuestionInvalid},
		"below the range":   {[]string{"price_earnings_max"}, []string{"0"}, nil, ErrQuestionInvalid},
		"above the range":   {[]string{"price_earnings_max"}, []string{"1000.0001"}, nil, ErrQuestionInvalid},
		"exponent":          {[]string{"price_earnings_max"}, []string{"1e3"}, nil, ErrQuestionInvalid},
		"fraction":          {[]string{"roe_min"}, []string{"1/8"}, nil, ErrQuestionInvalid},
		"five decimals":     {[]string{"roe_min"}, []string{"0.12345"}, nil, ErrQuestionInvalid},
		"half a year":       {[]string{"positive_years_min"}, []string{"2.5"}, nil, ErrQuestionInvalid},
		"six years":         {[]string{"positive_years_min"}, []string{"6"}, nil, ErrQuestionInvalid},
		"limit on a signal": {[]string{"piotroski_p1"}, []string{"1"}, nil, ErrQuestionInvalid},
		"limit on an own":   {[]string{""}, []string{"1"}, nil, ErrQuestionInvalid},
		"one for two":       {[]string{"roe_min", ""}, []string{"0.1"}, nil, ErrQuestionInvalid},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := cleanLimits(tc.limits, tc.facts)
			if !errors.Is(err, tc.err) || !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("limits = %v, %v; want %v, %v", got, err, tc.want, tc.err)
			}
		})
	}
}

func TestWithIdealsTwentyQuestions(t *testing.T) {
	t.Parallel()

	class := func(n int) Plan {
		c := PlanClass{Name: "A", TargetBP: 10000}
		m := PlanMember{Instrument: "QSTA3"}

		for i := range n {
			c.Questions = append(c.Questions, string(rune('a'+i)))
			m.Answers = append(m.Answers, true)
		}

		c.Members = []PlanMember{m}

		return Plan{Classes: []PlanClass{c}}
	}

	if _, err := class(20).WithIdeals(); err != nil {
		t.Fatalf("20 questions: %v", err)
	}

	if _, err := class(21).WithIdeals(); !errors.Is(err, ErrQuestionInvalid) {
		t.Fatalf("21 questions: %v, want %v", err, ErrQuestionInvalid)
	}
}

func withYears(positive, years int, end time.Time) CompanyFacts {
	return CompanyFacts{Criteria: CompanyCriteria{
		PositiveYears: positive, FiscalYears: years, YearsEnd: end,
	}}
}

func ratOf(s string) *big.Rat {
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		panic(s)
	}

	return r
}

func amount(n int64) *int64 { return &n }
