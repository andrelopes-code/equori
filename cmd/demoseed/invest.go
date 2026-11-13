package main

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"
)

// quote is the price of a security on one date.
type quote struct {
	date  string
	value float64
}

// buildInvestments defines the instruments and the accounts that hold them, then generates their monthly price series.
func (s *seeder) buildInvestments(start string) {
	s.createMercadoBitcoin(start)
	s.createSecurities(start)
}

func (s *seeder) createMercadoBitcoin(start string) {
	s.ids["inst.mb"] = s.create("/institutions", map[string]any{"name": "Mercado Bitcoin"})
	s.ids["mb"] = s.create(
		"/accounts",
		map[string]any{
			"name":           "Mercado Bitcoin",
			"class":          "asset",
			"kind":           "brokerage",
			"currency":       "BRL",
			"institution_id": s.id("inst.mb"),
			"opened_on":      start,
			"color":          8,
		},
	)

	s.ids["mb.cash"] = s.create(
		"/accounts",
		map[string]any{
			"name":           "Saldo Mercado Bitcoin",
			"class":          "asset",
			"kind":           "brokerage",
			"currency":       "BRL",
			"institution_id": s.id("inst.mb"),
			"parent_id":      s.id("mb"),
			"opened_on":      start,
			"color":          8,
		},
	)
}

func (s *seeder) createSecurities(start string) {
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
			"opened_on": start,
			"color":     4,
		})
		s.series(sec)
	}
}

// series draws the price at the first day of every month, one point past the last month so that interpolation never runs out.
func (s *seeder) series(sec security) {
	n := len(months(s.start, s.today)) + 1
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
	i := (d.Year()-s.start.Year())*12 + int(d.Month()-s.start.Month())
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

		for _, m := range months(s.start, s.today) {
			d := m.AddDate(0, 1, -1)
			for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
				d = d.AddDate(0, 0, -1)
			}

			if d.After(s.today) {
				d = s.today
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
		"&from=" + iso(s.start) +
		"&to=" + iso(s.today)
}

// buy schedules a purchase of about reais reais of code on d, in whole units of the scale of the security.
func (s *seeder) buy(d time.Time, code string, reais float64) {
	sec := s.security(code)
	price := s.priceOn(code, d) * (1 + (s.rng.Float64()*2-1)*.006)
	unit := math.Pow(10, float64(sec.scale))

	qty := int64(math.Round(reais / price * unit))
	if qty < 1 {
		qty = 1
	}

	s.at(d, func() { s.trade(d, code, "buy", qty, price) })
}

// sell schedules a sale of qty units of code on d.
func (s *seeder) sell(d time.Time, code string, qty int64) {
	price := s.priceOn(code, d) * (1 + (s.rng.Float64()*2-1)*.006)
	s.at(d, func() { s.trade(d, code, "sell", qty, price) })
}

// brokerageFloor is the cash the owner keeps in the brokerage after reinvesting the month, in cents.
const brokerageFloor = 250000

// sweep invests on d the cash of the brokerage above floor in code, the way an owner reinvests the income and the contributions the month left.
func (s *seeder) sweep(d time.Time, code string, floor int64) {
	s.at(d, func() {
		spare := s.bal[s.id("xp.cash")] - floor
		if spare < 50000 {
			return
		}

		sec := s.security(code)
		price := s.priceOn(code, d) * (1 + (s.rng.Float64()*2-1)*.006)

		qty := int64(math.Floor(float64(spare) / 100 / price * math.Pow(10, float64(sec.scale))))
		if qty < 1 {
			return
		}

		s.trade(d, code, "buy", qty, price)
	})
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

// trades are the initial portfolio, the monthly purchases and a few sales.
func (s *seeder) trades() {
	first := s.businessDay(s.start, 2)
	for _, in := range []struct {
		code  string
		reais float64
	}{
		{"ITUB4", 6600}, {"WEGE3", 7950}, {"PETR4", 10980}, {"BBAS3", 4100}, {"HGLG11", 6400}, {"KNRI11", 7200},
		{"MXRF11", 5050}, {"IVVB11", 9900}, {"TSELIC29", 21800}, {"CDBXP27", 15300},
	} {
		s.buy(first.AddDate(0, 0, s.rng.IntN(3)), in.code, in.reais)
	}

	fiis := []string{"HGLG11", "KNRI11", "MXRF11"}

	equities := []string{"ITUB4", "WEGE3", "BBAS3", "PETR4"}

	sweeps := []string{"HGLG11", "KNRI11", "IVVB11", "TSELIC29", "ITUB4"}
	for i, m := range months(s.start, s.today) {
		s.sweep(s.businessDay(m, 9), sweeps[i%len(sweeps)], brokerageFloor)

		d := s.businessDay(m, 7)
		switch i % 4 {
		case 0:
			s.buy(d, fiis[(i/4)%3], 1350)
		case 1:
			s.buy(d, equities[(i/4)%4], 1350)
		case 2:
			s.buy(d, "IVVB11", 750)
			s.buy(d.AddDate(0, 0, 1), "BTCBRL", 100)
		case 3:
			code := "TSELIC29"
			if (i/4)%2 == 1 {
				code = "TIPCA35"
			}

			s.buy(d, code, 1350)
		}
	}

	s.buy(day("2025-03-17"), "CDBXP27", 6000)
	s.buy(day("2026-03-16"), "CDBXP27", 6000)
	s.buy(day("2024-12-23"), "TSELIC29", 1500)
	s.buy(day("2025-12-22"), "TSELIC29", 1500)

	s.sell(day("2025-09-18"), "PETR4", 100)
	s.sell(day("2026-02-12"), "WEGE3", 60)
	s.sell(day("2026-06-10"), "IVVB11", 8)
	s.sell(day("2026-08-20"), "MXRF11", 100)
}

var allMonths = []time.Month{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}

// income schedules each payout on the units held when it falls due.
func (s *seeder) income() {
	for _, m := range months(s.start, s.today) {
		for _, p := range payouts {
			if !containsMonth(p.months, m.Month()) {
				continue
			}

			d := onDay(m, p.day)

			per := p.perShare
			for from, v := range p.steps {
				if from <= ym(m) {
					per = v
				}
			}

			s.at(d, func() {
				units := s.hold[p.code]

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
