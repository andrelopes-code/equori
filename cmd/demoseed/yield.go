package main

import (
	"math"
	"net/http"
	"time"
)

// yieldAccounts are the accounts that credit interest by themselves, with the monthly rate of each month.
var yieldAccounts = []struct {
	key  string
	rate func(month time.Time) float64
}{
	{"itau.savings", savingsRate},
	{"nubank.reserve", cdiRate},
}

// bookYield asserts the balance of each yielding account at every month-end with the interest of the month, which the ledger books as yield. The current month yields up to the day before today.
func (s *seeder) bookYield() {
	for _, m := range months(s.start, s.today) {
		end, share := m.AddDate(0, 1, -1), 1.0
		if !end.Before(s.today) {
			end = s.today.AddDate(0, 0, -1)
			share = float64(end.Day()) / float64(m.AddDate(0, 1, -1).Day())
		}

		if end.Before(m) {
			continue
		}

		for _, a := range yieldAccounts {
			cents := s.balanceOn(a.key, iso(end))
			interest := int64(math.Round(float64(cents) * a.rate(m) * share))

			s.do(http.MethodPost, "/accounts/"+s.id(a.key)+"/balance-assertions", map[string]any{"date": iso(end), "amount": brl(cents + interest), "source": "manual"}, nil)
		}
	}
}

// savingsRate is the monthly rate of the savings book: 0.5 % plus the reference rate, which rises with the Selic.
func savingsRate(month time.Time) float64 {
	return float64(step(month, 63, map[string]int64{"2025-05": 66})) / 10000
}

// cdiRate is the monthly CDI, from an annual rate that follows the Selic path of the history.
func cdiRate(month time.Time) float64 {
	annual := step(month, 1115, map[string]int64{"2025-01": 1215, "2025-03": 1315, "2025-06": 1490, "2026-04": 1440, "2026-07": 1390, "2026-10": 1340})

	return math.Pow(1+float64(annual)/10000, 1.0/12) - 1
}

// balanceOn reads the booked balance of an account at the end of a day.
func (s *seeder) balanceOn(key, date string) int64 {
	var out struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	s.do(http.MethodGet, "/accounts/"+s.id(key)+"/balance?date="+date+"&basis=booked", nil, &out)

	return out.Balance.Amount
}
