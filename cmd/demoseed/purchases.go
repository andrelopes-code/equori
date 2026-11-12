package main

import (
	"fmt"
	"net/http"
	"time"
)

// installments records a card purchase in n installments and returns the id of its transaction and of its plan.
func (s *seeder) installments(
	d time.Time,
	card, category, payee, desc string,
	total int64,
	n int,
	tags ...string,
) (txID, planID string) {
	body := map[string]any{
		"card_account_id": s.id(
			card,
		),
		"date":              iso(d),
		"description":       desc,
		"payee_id":          s.id("payee." + payee),
		"splits":            []posting{post(s.id(category), total)},
		"installment_count": n,
	}
	if len(tags) > 0 {
		body["tags"] = tags
	}

	var out struct {
		PlanID      string `json:"plan_id"`
		Transaction struct {
			ID string `json:"id"`
		} `json:"transaction"`
	}
	s.do(http.MethodPost, "/installment-purchases", body, &out)

	return out.Transaction.ID, out.PlanID
}

// foreign records a charge in euros on a card; the rate is reais per euro.
func (s *seeder) foreign(
	d time.Time,
	card, category, payee, desc string,
	euroCents int64,
	rate string,
) {
	s.do(http.MethodPost, "/foreign-purchases", map[string]any{
		"account_id": s.id(
			card,
		),
		"category_id": s.id(category),
		"date":        iso(d),
		"description": desc,
		"payee_id":    s.id("payee." + payee),
		"original": money{
			Amount:   euroCents,
			Currency: "EUR",
		},
		"rate":                       rate,
		"foreign_charge_category_id": s.id("tax.iof"),
	}, nil)
}

type place struct{ payee, category string }

// trip schedules two or three purchases a day, at the given places, from the first to the last day of a trip.
func (s *seeder) trip(tag, from, to string, top int64, via string, places []place) {
	for d := day(from); !d.After(day(to)); d = d.AddDate(0, 0, 1) {
		for range 2 + s.rng.IntN(2) {
			cents := s.between(2500, top, 2)
			cents -= cents % 10
			p := places[s.rng.IntN(len(places))]
			when := d
			s.at(
				when,
				func() { s.expense(when, via, p.category, p.payee, "Viagem, "+p.payee, cents, tag) },
			)
		}
	}
}

func (s *seeder) lisbon() {
	s.lisbonBookings()
	s.lisbonSpending()
}

func (s *seeder) lisbonBookings() {
	s.at(day("2025-03-20"), func() {
		tx, _ := s.installments(
			day("2025-03-20"),
			"card.itau",
			"travel.flights",
			"Latam Airlines",
			"Passagens São Paulo para Lisboa (ida e volta)",
			560000,
			10,
			"viagem-lisboa",
		)
		s.attach(
			tx,
			"bilhete-latam-lisboa.pdf",
			"LATAM Airlines - bilhete eletrônico",
			"Passageira: MARIANA C RIBEIRO",
			"GRU - LIS - GRU",
			"Valor: R$ 5.600,00 em 10x",
		)
	})
	s.at(day("2025-04-02"), func() {
		s.foreign(
			day("2025-04-02"),
			"card.nubank",
			"travel.lodging",
			"Booking.com",
			"Hotel em Alfama, 9 noites",
			124000,
			"6.2140",
		)
	})
}

func (s *seeder) lisbonSpending() {
	eur := []struct {
		date, category, payee, desc string
		cents                       int64
	}{
		{"2025-07-12", "food.restaurants", "Coco Bambu", "Jantar de chegada em Lisboa", 4850},
		{"2025-07-13", "travel.activities", "Sympla", "Bilhetes do Castelo de São Jorge", 2400},
		{"2025-07-13", "food.coffee", "Starbucks", "Pastéis de nata e café", 1180},
		{"2025-07-14", "travel.activities", "Sympla", "Passeio de elétrico e Miradouros", 3600},
		{"2025-07-15", "food.restaurants", "Madero", "Almoço em Belém", 3260},
		{"2025-07-15", "travel.activities", "Ingresso.com", "Mosteiro dos Jerónimos", 1800},
		{"2025-07-16", "shopping.gifts", "Livraria da Vila", "Livros e lembranças", 5290},
		{"2025-07-17", "travel.activities", "Sympla", "Day trip a Sintra", 7200},
		{"2025-07-17", "food.restaurants", "Outback Steakhouse", "Jantar em Sintra", 5640},
		{
			"2025-07-19",
			"food.restaurants",
			"Bar do Zé Pinheiros",
			"Petiscos e vinho no Bairro Alto",
			4120,
		},
		{"2025-07-20", "shopping.clothes", "Zara", "Roupas na Avenida da Liberdade", 8990},
		{"2025-07-21", "food.restaurants", "Coco Bambu", "Jantar de despedida", 7150},
	}
	for i, e := range eur {
		rate := fmt.Sprintf("6.%04d", 4400+(i*37)%260)
		s.at(day(e.date), func() {
			s.foreign(day(e.date), "card.nubank", e.category, e.payee, e.desc, e.cents, rate)
		})
	}
}
