package main

import (
	"fmt"
	"math"
	"net/http"
	"time"
)

// habit is a recurring kind of purchase: how often it happens in a month, how much it costs and how it is paid.
type habit struct {
	category string
	payees   []string
	desc     string // format with the payee name
	count    [2]int // purchases per month, inclusive
	chance   float64
	lo, hi   int64
	skew     float64
	vias     []string
	weights  []int
	weekend  bool // favors Friday to Sunday.
	weekday  bool // favors Monday to Friday.
	round    bool
	from     string
	season   *[12]float64
	tags     []string
}

var (
	giftSeason     = [12]float64{1, .8, 1, 1, 1.4, 1, 1, 1, 1, 1, 1.8, 3}
	clothesSeason  = [12]float64{1, .8, 1, 1, 1, .9, 1.2, 1, 1, 1, 2, 1.5}
	diningSeason   = [12]float64{1.2, .9, 1, 1, 1, 1, 1.1, 1, 1, 1, 1.1, 1.4}
	pharmacySeason = [12]float64{1, 1, 1, 1.1, 1.3, 1.5, 1.5, 1.3, 1, 1, 1, 1}
)

// lifestyle scales every variable purchase, in percent, so that the spending leaves the savings rate of the persona.
const lifestyle = 78

var habits = []habit{
	{category: "food.groceries", payees: []string{"Pão de Açúcar", "Carrefour", "Mercado Dia", "Empório Santa Luzia"}, desc: "Compras no %s", count: [2]int{7, 10}, lo: 4200, hi: 38000, skew: 2,
		vias: []string{"alelo.meal", "card.itau", "card.nubank", "nubank.checking"}, weights: []int{70, 12, 12, 6}, weekend: true},
	{category: "food.produce", payees: []string{"Hortifruti Natural da Terra"}, desc: "Feira de sábado, %s", count: [2]int{3, 5}, lo: 3500, hi: 9500, skew: 1,
		vias: []string{"wallet", "nubank.checking"}, weights: []int{40, 60}, round: true},
	{category: "food.bakery", payees: []string{"Padaria Bella Paulista"}, desc: "%s", count: [2]int{5, 9}, lo: 1400, hi: 5200, skew: 2,
		vias: []string{"alelo.meal", "wallet", "card.nubank"}, weights: []int{65, 15, 20}},
	{category: "food.restaurants", payees: []string{"Outback Steakhouse", "Coco Bambu", "Madero", "Burger King"}, desc: "Almoço ou jantar, %s", count: [2]int{5, 8}, lo: 6800, hi: 21000, skew: 2,
		vias: []string{"alelo.meal", "card.itau", "card.nubank"}, weights: []int{60, 22, 18}, weekend: true, round: true, season: &diningSeason},
	{category: "food.delivery", payees: []string{"iFood", "Rappi", "99Food"}, desc: "Pedido no %s", count: [2]int{6, 10}, lo: 3800, hi: 9500, skew: 1,
		vias: []string{"card.nubank", "card.itau"}, weights: []int{65, 35}, round: true},
	{category: "food.coffee", payees: []string{"Starbucks", "Cafeteria Santo Grão"}, desc: "Café, %s", count: [2]int{4, 8}, lo: 1400, hi: 3600, skew: 1,
		vias: []string{"alelo.meal", "card.nubank"}, weights: []int{70, 30}, round: true, weekday: true},
	{category: "food.bars", payees: []string{"Bar do Zé Pinheiros"}, desc: "Happy hour, %s", count: [2]int{2, 4}, lo: 8000, hi: 26000, skew: 1,
		vias: []string{"card.itau", "nubank.checking", "wallet"}, weights: []int{50, 30, 20}, weekend: true, round: true},
	{category: "transport.rideshare", payees: []string{"Uber", "99"}, desc: "Corrida %s", count: [2]int{8, 14}, lo: 1400, hi: 5800, skew: 2,
		vias: []string{"card.nubank", "card.itau"}, weights: []int{70, 30}, weekday: true},
	{category: "transport.coach", payees: []string{"Buser"}, desc: "Passagem de ônibus, %s", count: [2]int{0, 1}, chance: .3, lo: 8900, hi: 15900, skew: 1,
		vias: []string{"card.itau"}, weights: []int{1}},
	{category: "health.pharmacy", payees: []string{"Drogasil", "Droga Raia", "Pague Menos"}, desc: "Farmácia, %s", count: [2]int{2, 4}, lo: 2500, hi: 14000, skew: 2,
		vias: []string{"card.nubank", "nubank.checking", "card.itau"}, weights: []int{50, 30, 20}, season: &pharmacySeason},
	{category: "health.appointments", payees: []string{"Dra. Helena Prado"}, desc: "Consulta, %s", count: [2]int{0, 1}, chance: .35, lo: 28000, hi: 45000, skew: 1,
		vias: []string{"nubank.checking"}, weights: []int{1}, round: true},
	{category: "health.exams", payees: []string{"Laboratório Fleury"}, desc: "Exames, %s", count: [2]int{0, 1}, chance: .15, lo: 9000, hi: 32000, skew: 1,
		vias: []string{"card.itau"}, weights: []int{1}},
	{category: "leisure.events", payees: []string{"Cinemark", "Ingresso.com", "Sympla"}, desc: "Ingressos, %s", count: [2]int{1, 3}, lo: 3600, hi: 14000, skew: 2,
		vias: []string{"card.nubank", "card.itau"}, weights: []int{60, 40}, weekend: true, round: true},
	{category: "leisure.games", payees: []string{"Steam"}, desc: "Jogo na %s", count: [2]int{0, 1}, chance: .25, lo: 4000, hi: 22000, skew: 1,
		vias: []string{"card.nubank"}, weights: []int{1}},
	{category: "leisure.books", payees: []string{"Livraria da Vila", "Kindle"}, desc: "Livro, %s", count: [2]int{0, 2}, chance: .6, lo: 3500, hi: 9500, skew: 1,
		vias: []string{"card.itau", "card.nubank"}, weights: []int{60, 40}},
	{category: "leisure.hobbies", payees: []string{"Decathlon"}, desc: "Material esportivo, %s", count: [2]int{0, 1}, chance: .3, lo: 8000, hi: 35000, skew: 1,
		vias: []string{"card.nubank"}, weights: []int{1}},
	{category: "shopping.clothes", payees: []string{"Zara", "Renner", "C&A", "Centauro"}, desc: "Roupas, %s", count: [2]int{0, 2}, chance: .55, lo: 9000, hi: 48000, skew: 2,
		vias: []string{"card.itau", "card.nubank"}, weights: []int{70, 30}, season: &clothesSeason},
	{category: "shopping.care", payees: []string{"Barbearia & Salão Vila"}, desc: "Corte e escova, %s", count: [2]int{1, 1}, lo: 12000, hi: 18000, skew: 1,
		vias: []string{"nubank.checking", "wallet", "card.nubank"}, weights: []int{60, 10, 30}, round: true},
	{category: "shopping.care", payees: []string{"Boticário"}, desc: "Cosméticos, %s", count: [2]int{0, 1}, chance: .4, lo: 8900, hi: 19000, skew: 1,
		vias: []string{"card.itau"}, weights: []int{1}},
	{category: "shopping.gifts", payees: []string{"Amazon", "Mercado Livre", "Boticário"}, desc: "Presente, %s", count: [2]int{0, 2}, chance: .4, lo: 9000, hi: 32000, skew: 1,
		vias: []string{"card.itau"}, weights: []int{1}, season: &giftSeason, tags: []string{"presente"}},
	{category: "housing.decor", payees: []string{"Tok&Stok", "Leroy Merlin", "Amazon"}, desc: "Casa, %s", count: [2]int{0, 1}, chance: .3, lo: 8000, hi: 60000, skew: 2,
		vias: []string{"card.nubank"}, weights: []int{1}},
	{category: "housing.repairs", payees: []string{"Leroy Merlin"}, desc: "Reparo no apartamento, %s", count: [2]int{0, 1}, chance: .12, lo: 15000, hi: 48000, skew: 1,
		vias: []string{"card.itau"}, weights: []int{1}},
	{category: "pets.supplies", payees: []string{"Cobasi"}, desc: "Areia e petiscos, %s", count: [2]int{0, 1}, chance: .5, lo: 5990, hi: 9990, skew: 1,
		vias: []string{"card.nubank"}, weights: []int{1}, tags: []string{"gato"}},
}

// count draws how many purchases of h happen in month; the intensity of the month scales the count.
func (s *seeder) count(h habit, month time.Time, intensity float64) int {
	n := h.count[0] + s.rng.IntN(h.count[1]-h.count[0]+1)
	if h.chance > 0 && s.rng.Float64() > h.chance {
		n = 0
	}

	if h.season != nil {
		f := h.season[month.Month()-1]
		n = int(float64(n)*f + s.rng.Float64())
	}

	return int(float64(n)*intensity + s.rng.Float64())
}

// discretionary lists the categories an owner cuts or indulges in from one month to the next; the others follow the household.
var discretionary = map[string]bool{
	"food.restaurants": true, "food.delivery": true, "food.coffee": true, "food.bars": true,
	"leisure.events": true, "leisure.games": true, "leisure.books": true, "leisure.hobbies": true,
	"shopping.clothes": true, "shopping.care": true, "shopping.gifts": true, "housing.decor": true,
}

// intensities draws how much a month weighs on the discretionary and on the essential habits: a lean month and a loose month alternate around 1.
func (s *seeder) intensities() (loose, essential float64) {
	loose = min(max(math.Exp(.3*s.rng.NormFloat64()-.045), .5), 1.9)
	essential = min(max(math.Exp(.08*s.rng.NormFloat64()-.003), .8), 1.25)

	return loose, essential
}

// dayOf draws the day of a purchase; weekend habits favor Friday to Sunday.
func (s *seeder) dayOf(h habit, month time.Time) time.Time {
	last := month.AddDate(0, 1, -1).Day()
	for {
		d := onDay(month, 1+s.rng.IntN(last))

		wd := d.Weekday()
		onWeekend := wd == time.Friday || wd == time.Saturday || wd == time.Sunday

		if (!h.weekend && !h.weekday) || (h.weekend && onWeekend) || (h.weekday && wd != time.Saturday && wd != time.Sunday) || s.rng.Float64() < .25 {
			return d
		}
	}
}

func (s *seeder) spending(month time.Time) {
	loose, essential := s.intensities()
	for _, h := range habits {
		if h.from != "" && ym(month) < h.from {
			continue
		}

		intensity := essential
		if discretionary[h.category] {
			intensity = loose
		}

		for range s.count(h, month, intensity) {
			d := s.dayOf(h, month)
			payee := h.payees[s.rng.IntN(len(h.payees))]

			cents := s.between(h.lo, h.hi, h.skew) * lifestyle / 100
			if h.round {
				cents -= cents % 10
			}

			via := s.pick(h.vias, h.weights)
			desc := fmt.Sprintf(h.desc, payee)
			s.at(d, func() { s.expense(d, via, h.category, payee, desc, cents, h.tags...) })
		}
	}

	s.therapy(month)
	s.sharedDinners(month)
	s.occasions(month)
	s.surprises(month)
}

// therapy is one session every Thursday, with a few cancelled weeks.
func (s *seeder) therapy(month time.Time) {
	cents := step(month, 22000, map[string]int64{"2025-07": 24000})
	for _, d := range weekdaysOf(month, time.Thursday) {
		if s.rng.Float64() < .1 {
			continue
		}

		s.at(d, func() {
			s.expense(d, "nubank.checking", "health.therapy", "Clínica Mente Aberta", "Sessão de terapia", cents)
		})
	}
}

// sharedDinners are dinners paid on a card and split with Rafael, who repays by Pix a few days later.
func (s *seeder) sharedDinners(month time.Time) {
	for range 1 + s.rng.IntN(2) {
		d := s.dayOf(habit{weekend: true}, month)
		total := s.between(14000, 38000, 1)
		total -= total % 20
		half := total / 2
		payee := []string{"Coco Bambu", "Madero", "Outback Steakhouse", "Bar do Zé Pinheiros"}[s.rng.IntN(4)]
		via := s.pick([]string{"card.itau", "card.nubank"}, []int{60, 40})
		back := d.AddDate(0, 0, 2+s.rng.IntN(8))

		// Half of the dinners are recorded for the whole bill and repaid by a reimbursement; the others keep Rafael's half as a receivable.
		if s.rng.Float64() < .5 {
			s.reimbursedDinner(d, back, payee, via, total, half)
			continue
		}

		s.at(d, func() {
			s.record(iso(d), "Jantar com o Rafael, "+payee, map[string]any{"payee_id": s.id("payee." + payee), "tags": []string{"compartilhado"}},
				post(s.id(via), -total), post(s.id("food.restaurants"), half), post(s.id("receivable.rafael"), half))
		})
		s.at(back, func() {
			s.record(iso(back), "Rafael devolveu a parte do jantar", map[string]any{"payee_id": s.id("payee.Rafael Mendes")},
				post(s.id("itau.checking"), half), post(s.id("receivable.rafael"), -half))
		})
	}
}

// reimbursedDinner records the whole bill as a restaurant expense and, on back, Rafael's Pix as an inflow that reimburses half of it.
func (s *seeder) reimbursedDinner(d, back time.Time, payee, via string, total, half int64) {
	var dinner string

	s.at(d, func() {
		dinner = s.record(iso(d), "Jantar com o Rafael, "+payee, map[string]any{"payee_id": s.id("payee." + payee), "tags": []string{"compartilhado"}},
			post(s.id(via), -total), post(s.id("food.restaurants"), total))
	})
	s.at(back, func() {
		pix := s.record(iso(back), "Rafael devolveu a parte do jantar", map[string]any{"payee_id": s.id("payee.Rafael Mendes")},
			post(s.id("itau.checking"), half), post(s.id("system.uncategorized_income"), -half))
		s.do(http.MethodPost, "/transactions/"+pix+"/reimbursement", map[string]any{
			"expected_version": 1, "allocations": []map[string]any{{"original_id": dinner, "amount": brl(half)}},
		}, nil)
	})
}

// occasion is a dated expense of the calendar: a holiday gift, a birthday dinner, a check-up.
type occasion struct {
	month           time.Month
	day             int // zero: the second Sunday of the month.
	category, payee string
	desc            string
	lo, hi          int64
	vias            []string
	weights         []int
}

var occasions = []occasion{
	{month: 3, day: 14, category: "food.restaurants", payee: "Outback Steakhouse", desc: "Jantar de aniversário", lo: 42000, hi: 68000, vias: []string{"card.itau"}, weights: []int{1}},
	{month: 3, day: 18, category: "health.dental", payee: "Odonto Excellence", desc: "Revisão e limpeza", lo: 28000, hi: 36000, vias: []string{"nubank.checking"}, weights: []int{1}},
	{month: 9, day: 16, category: "health.dental", payee: "Odonto Excellence", desc: "Revisão e limpeza", lo: 28000, hi: 38000, vias: []string{"nubank.checking"}, weights: []int{1}},
	{month: 4, day: 4, category: "shopping.gifts", payee: "Cacau Show", desc: "Ovos de Páscoa", lo: 9000, hi: 21000, vias: []string{"card.nubank"}, weights: []int{1}},
	{month: 5, category: "shopping.gifts", payee: "Boticário", desc: "Presente do Dia das Mães", lo: 15000, hi: 30000, vias: []string{"card.itau", "card.nubank"}, weights: []int{60, 40}},
	{month: 5, category: "food.restaurants", payee: "Madero", desc: "Almoço do Dia das Mães", lo: 22000, hi: 38000, vias: []string{"card.itau"}, weights: []int{1}},
	{month: 6, day: 12, category: "food.restaurants", payee: "Coco Bambu", desc: "Jantar do Dia dos Namorados", lo: 28000, hi: 44000, vias: []string{"card.nubank"}, weights: []int{1}},
	{month: 8, category: "shopping.gifts", payee: "Amazon", desc: "Presente do Dia dos Pais", lo: 12000, hi: 26000, vias: []string{"card.itau"}, weights: []int{1}},
	{month: 8, category: "food.restaurants", payee: "Outback Steakhouse", desc: "Almoço do Dia dos Pais", lo: 20000, hi: 34000, vias: []string{"card.nubank"}, weights: []int{1}},
	{month: 12, day: 24, category: "food.groceries", payee: "Pão de Açúcar", desc: "Compras da ceia de Natal", lo: 42000, hi: 68000, vias: []string{"card.itau"}, weights: []int{1}},
	{month: 12, day: 31, category: "food.restaurants", payee: "Coco Bambu", desc: "Jantar de réveillon", lo: 30000, hi: 52000, vias: []string{"card.nubank"}, weights: []int{1}},
}

// occasions schedules the dated expenses of month.
func (s *seeder) occasions(month time.Time) {
	for _, o := range occasions {
		if o.month != month.Month() {
			continue
		}

		d := onDay(month, o.day)
		if o.day == 0 {
			d = weekdaysOf(month, time.Sunday)[1]
		}

		cents := s.between(o.lo, o.hi, 1)
		cents -= cents % 10
		via := s.pick(o.vias, o.weights)
		s.at(d, func() { s.expense(d, via, o.category, o.payee, o.desc, cents) })
	}
}

// surprise is an unplanned expense that a month may bring.
type surprise struct {
	category, payee, desc string
	via                   string
}

var surprises = []surprise{
	{"housing.repairs", "Leroy Merlin", "Conserto do chuveiro e da torneira", "card.itau"},
	{"housing.repairs", "Leroy Merlin", "Troca da fechadura", "card.nubank"},
	{"pets.vet", "Clínica Veterinária Patas", "Consulta de urgência", "card.nubank"},
	{"health.appointments", "Dra. Helena Prado", "Consulta com especialista", "nubank.checking"},
	{"health.exams", "Laboratório Fleury", "Exames de rotina", "card.itau"},
	{"shopping.electronics", "KaBuM!", "Carregador e cabos", "card.nubank"},
	{"shopping.clothes", "Renner", "Casaco para o frio", "card.itau"},
	{"travel.lodging", "Airbnb", "Fim de semana em Campos do Jordão", "card.nubank"},
	{"leisure.events", "Sympla", "Ingresso de show", "card.itau"},
}

// surprises books, in three months out of ten, one unplanned expense on a random day.
func (s *seeder) surprises(month time.Time) {
	if s.rng.Float64() >= .3 {
		return
	}

	x := surprises[s.rng.IntN(len(surprises))]
	d := s.dayOf(habit{}, month)

	cents := s.between(20000, 150000, 2)
	cents -= cents % 10
	s.at(d, func() { s.expense(d, x.via, x.category, x.payee, x.desc, cents) })
}
