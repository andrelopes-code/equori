package main

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"
)

// investMonths is the length of the investment history; the rest of the persona keeps historyMonths.
const investMonths = 60

// quote is the price of a security on one date.
type quote struct {
	date  string
	value float64
}

// buildInvestments defines the instruments and the accounts that hold them, then generates their monthly price series.
func (s *seeder) buildInvestments() {
	s.createSecurities()
}

func (s *seeder) createSecurities() {
	for _, sec := range securities {
		body := map[string]any{
			"code":           sec.code,
			"type":           sec.typ,
			"scale":          sec.scale,
			"name":           sec.name,
			"quote_currency": "BRL",
		}
		if sec.exchange != "" {
			body["exchange"] = sec.exchange
		}

		if sec.subtype != "" {
			body["subtype"] = sec.subtype
		}

		s.do(http.MethodPost, "/instruments", body, nil)
		s.tolerate(
			"instrument_exists",
		) // instruments are shared by the whole instance, so a second seeding finds them.

		if sec.issuer != "" {
			// An instrument a previous seeding created keeps what it had, so the issuer is written as an edit.
			s.do(http.MethodPatch, "/instruments/"+sec.code, map[string]any{
				"name":    sec.name,
				"subtype": sec.subtype,
				"issuer":  map[string]any{"name": sec.issuer},
			}, nil)
		}

		if sec.terms != nil {
			s.do(http.MethodPut, "/instruments/"+sec.code+"/terms", sec.terms, nil)
		}

		s.ids[sec.key()] = s.create("/accounts", map[string]any{
			"name":     sec.holder + " " + sec.code,
			"class":    "asset",
			"kind":     "brokerage",
			"currency": sec.code,
			"institution_id": s.id(
				"inst." + sec.holder,
			),
			"parent_id": s.id(sec.holder),
			"opened_on": iso(s.investStart()),
			"color":     4,
		})
		s.series(sec)
	}
}

// series draws the price at the first day of every month, one point past the last month so that interpolation never runs out.
func (s *seeder) series(sec security) {
	n := len(months(s.investStart(), s.today)) + 1
	pts := make([]float64, n)

	pts[0] = sec.start
	for i := 1; i < n; i++ {
		if sec.accrual > 0 {
			pts[i] = pts[i-1] * math.Pow(1+sec.accrual, 1.0/12)
			continue
		}

		pts[i] = pts[i-1] * math.Exp(sec.drift/12+sec.vol/math.Sqrt(12)*s.rng.NormFloat64())
	}

	if sec.accrual == 0 {
		// Pull the walk to the end price its drift implies, so that the volatility shapes the path without moving the outcome.
		want := math.Log(sec.start) + sec.drift*float64(n-1)/12

		gap := want - math.Log(pts[n-1])
		for i := range pts {
			pts[i] *= math.Exp(gap * float64(i) / float64(n-1))
		}
	}

	s.px[sec.code] = pts
}

// loadPrices reads back the chosen price of every security since the start of the history, so that a trade is priced like the instance prices it: with the real quotes when the feeds hold them.
func (s *seeder) loadPrices() {
	for _, sec := range securities {
		var list struct {
			Items []struct {
				Date  string `json:"date"`
				Value string `json:"value"`
			} `json:"items"`
		}

		s.do(
			http.MethodGet,
			s.pricesPath(sec.code),
			nil,
			&list,
		)

		quotes := make([]quote, 0, len(list.Items))

		for _, it := range list.Items {
			value, err := strconv.ParseFloat(it.Value, 64)
			if err != nil {
				s.fail("price of %s on %s: %v", sec.code, it.Date, err)
				return
			}

			quotes = append(quotes, quote{date: it.Date, value: value})
		}

		s.quotes[sec.code] = quotes
	}
}

// priceOn returns the last price of a security on or before date d, or the interpolated synthetic series when the instance holds none.
func (s *seeder) priceOn(code string, d time.Time) float64 {
	if q := s.quotes[code]; len(q) > 0 {
		i := sort.Search(len(q), func(i int) bool { return q[i].date > iso(d) })
		if i > 0 {
			i--
		}

		return q[i].value
	}

	pts := s.px[code]
	from := s.investStart()
	i := (d.Year()-from.Year())*12 + int(d.Month()-from.Month())
	frac := float64(d.Day()-1) / float64(d.AddDate(0, 1, -d.Day()+1).AddDate(0, 0, -1).Day())

	return pts[i] + (pts[i+1]-pts[i])*frac
}

func rate(p float64) string { return fmt.Sprintf("%.4f", p) }

// postPrices records the price of every security on the last business day of each month and on the last day.
// Prices are shared by every book of the instance and a manual price outranks the feeds (MQ1), so a
// security that already has a price keeps it.
func (s *seeder) postPrices() {
	for _, sec := range securities {
		if s.hasPrices(sec.code) {
			continue
		}

		dates := []time.Time{s.investStart()}
		for _, m := range months(s.investStart(), s.today) {
			d := m.AddDate(0, 1, -1)
			for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
				d = d.AddDate(0, 0, -1)
			}

			if d.After(s.today) {
				d = s.today
			}

			dates = append(dates, d)
		}

		for _, d := range dates {
			if issued, ok := sec.terms["issued_on"].(string); ok && iso(d) < issued {
				continue
			}

			s.do(
				http.MethodPost,
				"/prices",
				map[string]any{
					"instrument":       sec.code,
					"quote_instrument": "BRL",
					"date":             iso(d),
					"value":            rate(s.priceOn(sec.code, d)),
				},
				nil,
			)
		}
	}
}

// hasPrices reports whether the instance holds a price of code, in quote currency BRL, since the start of the history.
func (s *seeder) hasPrices(code string) bool {
	var list struct {
		Items []struct{} `json:"items"`
	}
	s.do(
		http.MethodGet,
		s.pricesPath(code),
		nil,
		&list,
	)

	return len(list.Items) > 0
}

// pricesPath is the request of the prices of code, in quote currency BRL, since the start of the history.
func (s *seeder) pricesPath(code string) string {
	return "/prices?instrument=" + code +
		"&quote_instrument=BRL" +
		"&from=" + iso(s.investStart()) +
		"&to=" + iso(s.today)
}

func (s *seeder) security(code string) security {
	for _, sec := range securities {
		if sec.code == code {
			return sec
		}
	}

	s.fail("unknown security %q", code)

	return security{}
}

func (s *seeder) trade(d time.Time, code, side string, qty int64, price float64) {
	sec := s.security(code)
	cash := sec.holder + ".cash"

	cost := int64(float64(qty) * price * 100 / math.Pow(10, float64(sec.scale)))
	if side == "buy" {
		s.ensure(d, cash, cost+cost/50)
	}

	s.do(http.MethodPost, "/trades", map[string]any{
		"account_id": s.id(sec.key()), "cash_account_id": s.id(cash), "side": side, "date": iso(d),
		"quantity": money{Amount: qty, Currency: code}, "unit_price": rate(price),
		"description": map[string]string{"buy": "Compra de ", "sell": "Venda de "}[side] + code,
	}, nil)

	sign := int64(1)
	if side == "sell" {
		sign = -1
	}

	s.bal[s.id(cash)] -= sign * cost
	s.hold[code] += sign * qty
}

var allMonths = []time.Month{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}

// income schedules each payout on the units held when it falls due. The amount is the annual yield of the payout on the price of the day, split among the months of the payout.
func (s *seeder) income() {
	for _, m := range months(s.investStart(), s.today) {
		for _, p := range payouts {
			if !containsMonth(p.months, m.Month()) {
				continue
			}

			d := onDay(m, p.day)

			s.investAt(d, func() {
				units := s.hold[p.code]
				per := s.priceOn(p.code, d) * p.yield / float64(len(p.months))

				gross := int64(float64(units) * per * 100)
				if gross < 1 {
					return
				}

				s.do(http.MethodPost, "/investment-income", map[string]any{
					"account_id": s.id(
						"sec." + p.code,
					),
					"cash_account_id": s.id("xp.cash"),
					"income_type":     p.kind,
					"date":            iso(d),
					"gross": brl(
						gross,
					),
					"category_id": s.id(p.category),
					"description": fmt.Sprintf(
						"%s de %s",
						map[string]string{"dividend": "Rendimento", "jcp": "JCP"}[p.kind],
						p.code,
					),
				}, nil)

				withheld := int64(0)
				if p.kind == "jcp" {
					withheld = gross * 15 / 100
				}

				s.bal[s.id("xp.cash")] += gross - withheld
			})
		}
	}
}

func containsMonth(list []time.Month, m time.Month) bool {
	for _, v := range list {
		if v == m {
			return true
		}
	}

	return false
}

// investStart is the first month of the investments, investMonths before today.
func (s *seeder) investStart() time.Time {
	return s.start.AddDate(0, historyMonths-investMonths, 0)
}

// investAt schedules run on d; a date before the first month of the investments or after today is dropped.
func (s *seeder) investAt(d time.Time, run func()) {
	if d.Before(s.investStart()) || d.After(s.today) {
		return
	}

	s.events = append(s.events, event{date: d, run: run})
}
