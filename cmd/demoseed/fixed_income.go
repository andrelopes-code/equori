package main

import (
	"fmt"
	"math"
	"net/http"
	"time"
)

// appliedGrowth is the annual rate the persona assumes for a contract when weighing the fixed income group.
const appliedGrowth = 0.11

// assumedInflation is the annual inflation of the coupons of a contract on an inflation index.
const assumedInflation = 0.048

// applied is a contract of the book: the code the application returned and what went into it.
type applied struct {
	code  string
	date  time.Time
	cents int64
}

// applyFixedIncome schedules each application and the interest dates that have passed since.
func (s *seeder) applyFixedIncome() {
	for i, a := range applications {
		month := firstOfMonth(s.today).AddDate(0, -a.monthsAgo, 0)
		d := s.businessDay(month, 10)

		s.investAt(d, func() { s.apply(i, a, d) })

		if a.couponEvery == 0 {
			continue
		}

		for paid := d.AddDate(0, a.couponEvery, 0); !paid.After(s.today); paid = paid.AddDate(0, a.couponEvery, 0) {
			s.investAt(paid, func() { s.receiveInterest(a, s.applied[i].code, paid) })
		}
	}
}

// apply records the contract and its purchase in one request, as the entry form does.
func (s *seeder) apply(i int, a application, d time.Time) {
	if a.index != "" && !s.hasRate(a.index, d) {
		s.fail(
			"the instance holds no rate of %s on %s: let the market data feeds run first",
			a.index,
			iso(d),
		)
		return
	}

	if d.Before(s.start) {
		// Its own words: the monthly contributions before the records are counted by theirs.
		s.record(
			iso(d),
			"Aplicação anterior ao registro",
			nil,
			post(s.id("xp.cash"), a.cents),
			post(s.id("system.opening_balances"), -a.cents),
		)
	} else {
		s.ensure(d, "xp.cash", a.cents)
	}

	var out struct {
		Instrument string `json:"instrument"`
		UnitPrice  string `json:"unit_price"`
	}

	s.do(http.MethodPost, "/fixed-income-applications", map[string]any{
		"application_id":  fmt.Sprintf("d0000000-0000-4000-8000-%012d", i+1),
		"brokerage_id":    s.id("xp"),
		"cash_account_id": s.id("xp.cash"),
		"applied_on":      iso(d),
		"amount":          brl(a.cents),
		"description":     "Aplicação em " + a.name,
		"contract":        a.contract(d),
	}, &out)

	// The instance accrues the price of a contract at the next tick of its feeds. Until then the price of the
	// purchase, typed on its own day, values the position; the accrual starts from it and gives the same value.
	s.do(http.MethodPost, "/prices", map[string]any{
		"instrument":       out.Instrument,
		"quote_instrument": "BRL",
		"date":             iso(d),
		"value":            out.UnitPrice,
	}, nil)

	s.bal[s.id("xp.cash")] -= a.cents
	s.applied[i] = applied{code: out.Instrument, date: d, cents: a.cents}
}

// hasRate reports whether the instance holds a rate of the index for the month of d; a contract without it has no price.
func (s *seeder) hasRate(index string, d time.Time) bool {
	var out struct {
		Items []struct{} `json:"items"`
	}

	month := firstOfMonth(d)
	path := "/indexes/" + index + "/rates?from=" + iso(
		month,
	) + "&to=" + iso(
		month.AddDate(0, 1, -1),
	)
	s.do(http.MethodGet, path, nil, &out)

	return len(out.Items) > 0
}

// contract is the body of the contract of an application made on d.
func (a application) contract(d time.Time) map[string]any {
	c := map[string]any{
		"subtype":         a.subtype,
		"issuer":          a.issuer,
		"name":            a.name,
		"matures_on":      iso(d.AddDate(0, a.termMonths, 0)),
		"daily_liquidity": a.dailyLiquidity,
	}

	if a.index != "" {
		c["index_id"] = a.index
	}

	if a.percentBP != 0 {
		c["percent_of_index_bp"] = a.percentBP
	}

	if a.spreadBP != 0 {
		c["spread_bp"] = a.spreadBP
	}

	if a.couponEvery != 0 {
		c["interest_every_months"] = a.couponEvery
		c["first_payment_on"] = iso(d.AddDate(0, a.couponEvery, 0))
	}

	return c
}

// receiveInterest records the interest the contract paid on the business day on or after d. The gross is what the
// contract accrued since the last payment at the rates the persona assumes; the notice of the broker states it.
func (s *seeder) receiveInterest(a application, code string, d time.Time) {
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday || s.holidays[d] {
		d = d.AddDate(0, 0, 1)
	}

	years := float64(a.couponEvery) / 12
	factor := math.Pow(1+assumedInflation, years) * math.Pow(1+float64(a.spreadBP)/10000, years)
	gross := int64(math.Round(float64(a.cents) * (factor - 1)))

	s.do(http.MethodPost, "/investment-income", map[string]any{
		"brokerage_id": s.id("xp"),
		"instrument":   code,
		"income_type":  "coupon",
		"date":         iso(d),
		"gross":        brl(gross),
		"category_id":  s.id("income.coupons"),
		"description":  "Juros de " + a.name,
	}, nil)

	s.bal[s.id("xp.cash")] += gross
}

// appliedValue is what the contracts are worth on d, in cents, at the rate the persona assumes.
func (s *seeder) appliedValue(d time.Time) int64 {
	var total float64

	for _, c := range s.applied {
		if c.code == "" || c.date.After(d) {
			continue
		}

		years := d.Sub(c.date).Hours() / 24 / 365
		total += float64(c.cents) * math.Pow(1+appliedGrowth, years)
	}

	return int64(total)
}
