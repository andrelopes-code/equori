package main

import (
	"fmt"
	"math"
	"net/http"
	"time"
)

// security is an instrument the persona holds. Prices are plausible, not historical: a random walk for variable income and an accrual for fixed income.
type security struct {
	code, name, typ, subtype, exchange string
	scale                              int
	holder                             string // key of the brokerage account that holds it
	start, drift, vol                  float64
	terms                              map[string]any
	accrual                            float64 // annual rate of a fixed income security; zero for a random walk
}

var securities = []security{
	{code: "ITUB4", name: "Itaú Unibanco PN", typ: "stock", exchange: "BVMF", holder: "xp", start: 33.1, drift: .18, vol: .22},
	{code: "WEGE3", name: "WEG ON", typ: "stock", exchange: "BVMF", holder: "xp", start: 53.2, drift: -.06, vol: .28},
	{code: "PETR4", name: "Petrobras PN", typ: "stock", exchange: "BVMF", holder: "xp", start: 36.6, drift: .02, vol: .27},
	{code: "BBAS3", name: "Banco do Brasil ON", typ: "stock", exchange: "BVMF", holder: "xp", start: 27.5, drift: -.12, vol: .30},
	{code: "HGLG11", name: "CSHG Logística FII", typ: "reit", exchange: "BVMF", holder: "xp", start: 160.4, drift: .02, vol: .09},
	{code: "KNRI11", name: "Kinea Renda Imobiliária FII", typ: "reit", exchange: "BVMF", holder: "xp", start: 160.9, drift: 0, vol: .09},
	{code: "MXRF11", name: "Maxi Renda FII", typ: "reit", exchange: "BVMF", holder: "xp", start: 10.1, drift: 0, vol: .08},
	{code: "IVVB11", name: "iShares S&P 500 Fundo de Índice", typ: "etf", exchange: "BVMF", holder: "xp", start: 331.5, drift: .12, vol: .18},
	{code: "TSELIC29", name: "Tesouro Selic 2029", typ: "fixed_income", subtype: "tesouro", scale: 2, holder: "xp", start: 14520, accrual: .142,
		terms: map[string]any{"issued_on": "2023-03-01", "matures_on": "2029-03-01", "index_id": "selic", "day_count": "act365", "face_value": 1200000}},
	{code: "CDBXP27", name: "CDB XP 112% do CDI", typ: "fixed_income", subtype: "cdb", scale: 2, holder: "xp", start: 1019.4, accrual: .152,
		terms: map[string]any{"issued_on": "2024-08-12", "matures_on": "2027-08-12", "index_id": "cdi", "percent_of_index_bp": 11200, "day_count": "bus252", "face_value": 100000}},
	{code: "TIPCA35", name: "Tesouro IPCA+ 2035", typ: "fixed_income", subtype: "tesouro", scale: 2, holder: "xp", start: 1480, drift: .12, vol: .05,
		terms: map[string]any{"issued_on": "2024-05-02", "matures_on": "2035-05-15", "index_id": "ipca", "spread_bp": 650, "day_count": "act365", "face_value": 100000}},
	{code: "BTCBRL", name: "Bitcoin", typ: "crypto", scale: 8, holder: "mb", start: 360000, drift: .35, vol: .6},
}

func (sec security) key() string { return "sec." + sec.code }

// buildInvestments defines the instruments and the accounts that hold them, then generates their monthly price series.
func (s *seeder) buildInvestments(start string) {
	s.ids["inst.mb"] = s.create("/institutions", map[string]any{"name": "Mercado Bitcoin"})
	s.ids["mb"] = s.create("/accounts", map[string]any{"name": "Mercado Bitcoin", "class": "asset", "kind": "brokerage", "currency": "BRL", "institution_id": s.id("inst.mb"), "opened_on": start, "color": 8})
	s.ids["mb.cash"] = s.create("/accounts", map[string]any{"name": "Saldo Mercado Bitcoin", "class": "asset", "kind": "brokerage", "currency": "BRL", "institution_id": s.id("inst.mb"), "parent_id": s.id("mb"), "opened_on": start, "color": 8})
	for _, sec := range securities {
		body := map[string]any{"code": sec.code, "type": sec.typ, "scale": sec.scale, "name": sec.name, "quote_currency": "BRL"}
		if sec.exchange != "" {
			body["exchange"] = sec.exchange
		}
		if sec.subtype != "" {
			body["subtype"] = sec.subtype
		}
		s.do(http.MethodPost, "/instruments", body, nil)
		s.tolerate("instrument_exists") // instruments are shared by the whole instance, so a second seeding finds them.
		if sec.terms != nil {
			s.do(http.MethodPut, "/instruments/"+sec.code+"/terms", sec.terms, nil)
		}
		s.ids[sec.key()] = s.create("/accounts", map[string]any{
			"name": sec.holder + " " + sec.code, "class": "asset", "kind": "brokerage", "currency": sec.code,
			"institution_id": s.id("inst." + sec.holder), "parent_id": s.id(sec.holder), "opened_on": start, "color": 4,
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

// priceOn interpolates the series of a security at date d.
func (s *seeder) priceOn(code string, d time.Time) float64 {
	pts := s.px[code]
	i := (d.Year()-s.start.Year())*12 + int(d.Month()-s.start.Month())
	frac := float64(d.Day()-1) / float64(d.AddDate(0, 1, -d.Day()+1).AddDate(0, 0, -1).Day())
	return pts[i] + (pts[i+1]-pts[i])*frac
}

func rate(p float64) string { return fmt.Sprintf("%.4f", p) }

// postPrices records the price of every security on the last business day of each month and on the last day.
func (s *seeder) postPrices() {
	for _, sec := range securities {
		for _, m := range months(s.start, s.today) {
			d := m.AddDate(0, 1, -1)
			for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
				d = d.AddDate(0, 0, -1)
			}
			if d.After(s.today) {
				d = s.today
			}
			s.do(http.MethodPost, "/prices", map[string]any{"instrument": sec.code, "quote_instrument": "BRL", "date": iso(d), "value": rate(s.priceOn(sec.code, d))}, nil)
		}
	}
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
	first := businessDay(s.start, 2)
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
	for i, m := range months(s.start, s.today) {
		d := businessDay(m, 7)
		switch i % 4 {
		case 0:
			s.buy(d, fiis[(i/4)%3], 900)
		case 1:
			s.buy(d, equities[(i/4)%4], 900)
		case 2:
			s.buy(d, "IVVB11", 500)
			s.buy(d.AddDate(0, 0, 1), "BTCBRL", 100)
		case 3:
			code := "TSELIC29"
			if (i/4)%2 == 1 {
				code = "TIPCA35"
			}
			s.buy(d, code, 900)
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

type payout struct {
	code, kind, category string
	months               []time.Month
	day                  int
	perShare             float64 // reais per unit
	steps                map[string]float64
}

var payouts = []payout{
	{code: "HGLG11", kind: "dividend", category: "income.fii", months: allMonths, day: 14, perShare: 1.10, steps: map[string]float64{"2025-08": 1.15}},
	{code: "KNRI11", kind: "dividend", category: "income.fii", months: allMonths, day: 14, perShare: .98, steps: map[string]float64{"2025-06": 1.00}},
	{code: "MXRF11", kind: "dividend", category: "income.fii", months: allMonths, day: 14, perShare: .10, steps: map[string]float64{"2025-04": .09}},
	{code: "ITUB4", kind: "dividend", category: "income.dividends", months: allMonths, day: 3, perShare: .0155},
	{code: "ITUB4", kind: "jcp", category: "income.jcp", months: []time.Month{2, 5, 8, 11}, day: 28, perShare: .25},
	{code: "PETR4", kind: "dividend", category: "income.dividends", months: []time.Month{2, 5, 8, 11}, day: 21, perShare: .74},
	{code: "BBAS3", kind: "dividend", category: "income.dividends", months: []time.Month{3, 6, 9, 12}, day: 20, perShare: .30},
	{code: "WEGE3", kind: "jcp", category: "income.jcp", months: []time.Month{3, 9}, day: 15, perShare: .14},
	{code: "WEGE3", kind: "dividend", category: "income.dividends", months: []time.Month{6, 12}, day: 15, perShare: .12},
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
					"account_id": s.id("sec." + p.code), "cash_account_id": s.id("xp.cash"), "income_type": p.kind, "date": iso(d),
					"gross": brl(gross), "category_id": s.id(p.category), "description": fmt.Sprintf("%s de %s", map[string]string{"dividend": "Rendimento", "jcp": "JCP"}[p.kind], p.code),
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

// transfers are the monthly contributions to investments, the lump sums from the 13th salary and PLR, and the income tax refund.
func (s *seeder) transfers() {
	for _, m := range months(s.start, s.today) {
		d := businessDay(m, 6)
		s.at(d, func() {
			s.ensure(d, "itau.checking", 140000)
			s.record(iso(d), "TED para XP Investimentos", nil, post(s.id("xp.cash"), 110000), post(s.id("itau.checking"), -110000))
			s.record(iso(d), "Aporte na caixinha de reserva", nil, post(s.id("nubank.reserve"), 30000), post(s.id("itau.checking"), -30000))
		})
	}
	lump := func(date, desc string, cents int64) {
		d := day(date)
		s.at(d, func() {
			s.ensure(d, "itau.checking", cents)
			s.record(date, desc, nil, post(s.id("xp.cash"), cents), post(s.id("itau.checking"), -cents))
		})
	}
	lump("2024-12-23", "TED para XP Investimentos, parte do 13º", 150000)
	lump("2025-12-22", "TED para XP Investimentos, parte do 13º", 150000)
	lump("2025-03-17", "TED para XP Investimentos, parte da PLR", 600000)
	lump("2026-03-16", "TED para XP Investimentos, parte da PLR", 600000)
	for _, r := range []struct {
		date  string
		cents int64
	}{{"2025-06-30", 284731}, {"2026-06-30", 196412}} {
		d := day(r.date)
		s.at(d, func() {
			s.record(r.date, "Restituição do imposto de renda", map[string]any{"payee_id": s.id("payee.Receita Federal")},
				post(s.id("itau.checking"), r.cents), post(s.id("income.refunds"), -r.cents))
		})
	}
}

// goals ties targets to the accounts that hold the savings for them.
func (s *seeder) goals() {
	s.create("/goals", map[string]any{
		"name": "Reserva de emergência", "target": brl(6000000), "due_on": "2027-06-30",
		"account_ids": []string{s.id("nubank.reserve"), s.id("itau.savings"), s.id("sec.TSELIC29")},
	})
	s.create("/goals", map[string]any{
		"name": "Viagem ao Japão", "target": brl(2800000), "due_on": "2027-09-01",
		"account_ids": []string{s.id("sec.CDBXP27"), s.id("sec.IVVB11")},
	})
	s.create("/goals", map[string]any{
		"name": "Entrada do apartamento", "target": brl(12000000), "due_on": "2030-01-01",
		"account_ids": []string{s.id("sec.ITUB4"), s.id("sec.WEGE3"), s.id("sec.HGLG11"), s.id("sec.KNRI11"), s.id("sec.TIPCA35")},
	})
}
