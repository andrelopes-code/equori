package main

import (
	"fmt"
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
	weekend  bool
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
const lifestyle = 85

var habits = []habit{
	{category: "food.groceries", payees: []string{"Pão de Açúcar", "Carrefour", "Mercado Dia", "Empório Santa Luzia"}, desc: "Compras no %s", count: [2]int{7, 10}, lo: 4200, hi: 38000, skew: 2,
		vias: []string{"alelo.meal", "card.itau", "card.nubank", "nubank.checking"}, weights: []int{70, 12, 12, 6}},
	{category: "food.produce", payees: []string{"Hortifruti Natural da Terra"}, desc: "Feira de sábado, %s", count: [2]int{3, 5}, lo: 3500, hi: 9500, skew: 1,
		vias: []string{"wallet", "nubank.checking"}, weights: []int{40, 60}, round: true},
	{category: "food.bakery", payees: []string{"Padaria Bella Paulista"}, desc: "%s", count: [2]int{5, 9}, lo: 1400, hi: 5200, skew: 2,
		vias: []string{"alelo.meal", "wallet", "card.nubank"}, weights: []int{65, 15, 20}},
	{category: "food.restaurants", payees: []string{"Outback Steakhouse", "Coco Bambu", "Madero", "Burger King"}, desc: "Almoço ou jantar, %s", count: [2]int{5, 8}, lo: 6800, hi: 21000, skew: 2,
		vias: []string{"alelo.meal", "card.itau", "card.nubank"}, weights: []int{60, 22, 18}, weekend: true, round: true, season: &diningSeason},
	{category: "food.delivery", payees: []string{"iFood", "Rappi", "99Food"}, desc: "Pedido no %s", count: [2]int{6, 10}, lo: 3800, hi: 9500, skew: 1,
		vias: []string{"card.nubank", "card.itau"}, weights: []int{65, 35}, round: true},
	{category: "food.coffee", payees: []string{"Starbucks", "Cafeteria Santo Grão"}, desc: "Café, %s", count: [2]int{4, 8}, lo: 1400, hi: 3600, skew: 1,
		vias: []string{"alelo.meal", "card.nubank"}, weights: []int{70, 30}, round: true},
	{category: "food.bars", payees: []string{"Bar do Zé Pinheiros"}, desc: "Happy hour, %s", count: [2]int{2, 4}, lo: 8000, hi: 26000, skew: 1,
		vias: []string{"card.itau", "nubank.checking", "wallet"}, weights: []int{50, 30, 20}, weekend: true, round: true},
	{category: "transport.rideshare", payees: []string{"Uber", "99"}, desc: "Corrida %s", count: [2]int{8, 14}, lo: 1400, hi: 5800, skew: 2,
		vias: []string{"card.nubank", "card.itau"}, weights: []int{70, 30}},
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

// count draws how many purchases of h happen in month.
func (s *seeder) count(h habit, month time.Time) int {
	n := h.count[0] + s.rng.IntN(h.count[1]-h.count[0]+1)
	if h.chance > 0 && s.rng.Float64() > h.chance {
		n = 0
	}
	if h.season != nil {
		f := h.season[month.Month()-1]
		n = int(float64(n)*f + s.rng.Float64())
	}
	return n
}

// dayOf draws the day of a purchase; weekend habits favor Friday to Sunday.
func (s *seeder) dayOf(h habit, month time.Time) time.Time {
	last := month.AddDate(0, 1, -1).Day()
	for {
		d := onDay(month, 1+s.rng.IntN(last))
		wd := d.Weekday()
		if !h.weekend || wd == time.Friday || wd == time.Saturday || wd == time.Sunday || s.rng.Float64() < .25 {
			return d
		}
	}
}

func (s *seeder) spending(month time.Time) {
	for _, h := range habits {
		if h.from != "" && ym(month) < h.from {
			continue
		}
		for range s.count(h, month) {
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
