package main

import (
	"fmt"
	"math"
	"net/http"
	"time"
)

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
	if h.saturday {
		saturdays := weekdaysOf(month, time.Saturday)

		return saturdays[s.rng.IntN(len(saturdays))]
	}

	last := month.AddDate(0, 1, -1).Day()
	for {
		d := onDay(month, 1+s.rng.IntN(last))

		wd := d.Weekday()
		onWeekend := wd == time.Friday || wd == time.Saturday || wd == time.Sunday

		if (!h.weekend && !h.weekday) || (h.weekend && onWeekend) ||
			(h.weekday && wd != time.Saturday && wd != time.Sunday) ||
			s.rng.Float64() < .25 {
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
			s.expense(
				d,
				"nubank.checking",
				"health.therapy",
				"Clínica Mente Aberta",
				"Sessão de terapia",
				cents,
			)
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
			s.record(
				iso(d),
				"Jantar com o Rafael, "+payee,
				map[string]any{
					"payee_id": s.id("payee." + payee),
					"tags":     []string{"compartilhado"},
				},
				post(
					s.id(via),
					-total,
				),
				post(s.id("food.restaurants"), half),
				post(s.id("receivable.rafael"), half),
			)
		})
		s.at(back, func() {
			s.record(
				iso(back),
				"Rafael devolveu a parte do jantar",
				map[string]any{"payee_id": s.id("payee.Rafael Mendes")},
				post(s.id("itau.checking"), half),
				post(s.id("receivable.rafael"), -half),
			)
		})
	}
}

// reimbursedDinner records the whole bill as a restaurant expense and, on back, Rafael's Pix as an inflow that reimburses half of it.
func (s *seeder) reimbursedDinner(d, back time.Time, payee, via string, total, half int64) {
	var dinner string

	s.at(d, func() {
		dinner = s.record(
			iso(d),
			"Jantar com o Rafael, "+payee,
			map[string]any{"payee_id": s.id("payee." + payee), "tags": []string{"compartilhado"}},
			post(s.id(via), -total),
			post(s.id("food.restaurants"), total),
		)
	})
	s.at(back, func() {
		pix := s.record(
			iso(back),
			"Rafael devolveu a parte do jantar",
			map[string]any{"payee_id": s.id("payee.Rafael Mendes")},
			post(s.id("itau.checking"), half),
			post(s.id("system.uncategorized_income"), -half),
		)
		s.do(http.MethodPost, "/transactions/"+pix+"/reimbursement", map[string]any{
			"expected_version": 1,
			"allocations":      []map[string]any{{"original_id": dinner, "amount": brl(half)}},
		}, nil)
	})
}

// pendingRepayment records a dinner of last week paid in full on the card and Rafael's Pix for half
// of it, not yet marked as a reimbursement: the case the help page of reimbursements shows. It
// draws no random number, so the rest of the book stays as it was.
func (s *seeder) pendingRepayment() {
	const total, half = 26400, 13200

	dinner := s.today.AddDate(0, 0, -5)
	back := s.today.AddDate(0, 0, -2)

	s.at(dinner, func() {
		s.record(
			iso(dinner),
			"Jantar com o Rafael, Coco Bambu",
			map[string]any{"payee_id": s.id("payee.Coco Bambu"), "tags": []string{"compartilhado"}},
			post(s.id("card.itau"), -total),
			post(s.id("food.restaurants"), total),
		)
	})
	s.at(back, func() {
		s.record(
			iso(back),
			"Rafael devolveu a parte do jantar",
			map[string]any{"payee_id": s.id("payee.Rafael Mendes")},
			post(s.id("itau.checking"), half),
			post(s.id("income.refunds"), -half),
		)
	})
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
