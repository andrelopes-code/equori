package main

import (
	"net/http"
	"sort"
	"time"
)

const (
	// nomadSpreadBP is the spread of the conversion of Nomad over the commercial rate.
	nomadSpreadBP = 200

	// The IOF on a transfer to an account of the same holder abroad rose from 1.1 % to 3.5 % on 2025-05-23.
	iofAbroadBP     = 110
	iofAbroadRaised = "2025-05-23"
	iofAbroadNewBP  = 350
)

// remittances are the transfers of the persona to the dollar account: a part of each PLR and the part of the 13th
// salary of 2025 that went to the brokerage before. The amount leaves the checking account with the IOF.
var remittances = []struct {
	date, desc string
	cents      int64
}{
	{"2025-03-18", "Remessa para a conta em dólar, parte da PLR", 200000},
	{"2025-12-23", "Remessa para a conta em dólar, parte do 13º", 150000},
	{"2026-03-17", "Remessa para a conta em dólar, parte da PLR", 200000},
}

// usdRates is the PTAX of the month-end, in ten-thousandths of a real per dollar, from each month on. The seeder
// converts at it when the instance holds no USD price; the instance values the account at its own prices only.
var usdRates = map[string]int64{
	"2024-11": 59900,
	"2024-12": 61900,
	"2025-01": 58400,
	"2025-02": 58800,
	"2025-03": 57400,
	"2025-04": 56600,
	"2025-05": 56700,
	"2025-06": 54600,
	"2025-07": 56000,
	"2025-08": 54200,
	"2025-09": 53200,
	"2025-10": 53800,
	"2025-11": 53300,
	"2025-12": 55000,
}

// dollars schedules each remittance due by today at the rate of its date, the spread of Nomad and the IOF in force.
func (s *seeder) dollars() {
	for _, r := range remittances {
		d := day(r.date)

		iof := int64(iofAbroadBP)
		if r.date >= iofAbroadRaised {
			iof = iofAbroadNewBP
		}

		s.at(d, func() {
			reais := r.cents * 10000 / (10000 + iof)
			usd := int64(float64(reais) / (s.usdRate(d) * (1 + nomadSpreadBP/10000.0)))

			s.ensure(d, "itau.checking", r.cents)
			s.do(http.MethodPost, "/exchanges", map[string]any{
				"from_account_id": s.id("itau.checking"),
				"to_account_id":   s.id("nomad.usd"),
				"date":            r.date,
				"description":     r.desc,
				"from_amount":     brl(reais),
				"to_amount":       money{Amount: usd, Currency: "USD"},
				"fee":             brl(r.cents - reais),
				"fee_category_id": s.id("tax.iof"),
			}, nil)

			if s.err == nil {
				s.bal[s.id("itau.checking")] -= r.cents
				s.bal[s.id("nomad.usd")] += usd
			}
		})
	}
}

// usdRate is the last USD price in reais the instance holds on or before d, or the month-end PTAX of usdRates.
func (s *seeder) usdRate(d time.Time) float64 {
	q := s.quotes["USD"]

	i := sort.Search(len(q), func(i int) bool { return q[i].date > iso(d) })
	if i > 0 {
		return q[i-1].value
	}

	return float64(step(d, usdRates["2024-11"], usdRates)) / 10000
}
