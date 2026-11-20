package main

import (
	"net/http"
	"slices"
	"time"
)

// rawWait is how long the seeder waits for the instance to fetch the official history it requested.
const rawWait = 20 * time.Minute

// adjustedSources are no official market close: yahoo_chart is unofficial and stored closes adjusted for later splits
// until migration 138; manual, csv and accrual prices were printed by no market. The persona trades on the closes of
// the official sources.
var adjustedSources = []string{"yahoo_chart", "manual", "csv", "accrual"}

// sourcedPrice is the date and the source of a chosen price.
type sourcedPrice struct {
	date, source string
}

// requestHistory asks the instance for the prices of every security since the first month of the investments. The
// instance fetches the official history of five years on its own (A222 MQ6); the persona invests for longer. It
// returns the codes some enabled source quotes.
func (s *seeder) requestHistory() []string {
	var out []string

	for _, sec := range securities {
		s.do(
			http.MethodPost,
			"/instruments/"+sec.code+"/history",
			map[string]any{"from": iso(s.investStart())},
			nil,
		)

		if s.err == nil {
			out = append(out, sec.code)
		}

		s.tolerate("no_source")
	}

	return out
}

// awaitRawHistory waits until the instance holds the official history of each of codes, so that no trade is priced
// on a close adjusted for a split recorded later.
func (s *seeder) awaitRawHistory(codes []string) {
	deadline := time.Now().Add(rawWait)

	for len(codes) > 0 && s.err == nil {
		codes = slices.DeleteFunc(codes, func(code string) bool {
			return rawHistoryCovers(s.sourcedPrices(code))
		})

		if len(codes) == 0 {
			return
		}

		if time.Now().After(deadline) {
			s.fail(
				"no official history since %s after %s for %v",
				iso(s.investStart()),
				rawWait,
				codes,
			)

			return
		}

		time.Sleep(10 * time.Second)
	}
}

// sourcedPrices lists the chosen prices of code since the first month of the investments.
func (s *seeder) sourcedPrices(code string) []sourcedPrice {
	var list struct {
		Items []struct {
			Date   string `json:"date"`
			Source string `json:"source"`
		} `json:"items"`
	}

	s.do(http.MethodGet, s.pricesPath(code), nil, &list)

	out := make([]sourcedPrice, len(list.Items))
	for i, it := range list.Items {
		out[i] = sourcedPrice{date: it.Date, source: it.Source}
	}

	return out
}

// rawHistoryCovers reports whether prices, the chosen prices of a security in date order, hold an official price within
// a month of the first price of any source.
func rawHistoryCovers(prices []sourcedPrice) bool {
	if len(prices) == 0 {
		return false
	}

	limit := iso(day(prices[0].date).AddDate(0, 1, 0))

	for _, p := range prices {
		if p.date > limit {
			return false
		}

		if !slices.Contains(adjustedSources, p.source) {
			return true
		}
	}

	return false
}
