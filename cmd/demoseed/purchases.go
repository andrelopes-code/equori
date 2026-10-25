package main

import (
	"fmt"
	"net/http"
	"time"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// installments records a card purchase in n installments and returns the id of its transaction and of its plan.
func (s *seeder) installments(d time.Time, card, category, payee, desc string, total int64, n int, tags ...string) (txID, planID string) {
	body := map[string]any{
		"card_account_id": s.id(card), "date": iso(d), "description": desc, "payee_id": s.id("payee." + payee),
		"splits": []posting{post(s.id(category), total)}, "installment_count": n,
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
func (s *seeder) foreign(d time.Time, card, category, payee, desc string, euroCents int64, rate string) {
	s.do(http.MethodPost, "/foreign-purchases", map[string]any{
		"account_id": s.id(card), "category_id": s.id(category), "date": iso(d), "description": desc, "payee_id": s.id("payee." + payee),
		"original": money{Amount: euroCents, Currency: "EUR"}, "rate": rate, "foreign_charge_category_id": s.id("tax.iof"),
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
			s.at(when, func() { s.expense(when, via, p.category, p.payee, "Viagem, "+p.payee, cents, tag) })
		}
	}
}

func (s *seeder) lisbon() {
	s.at(day("2025-03-20"), func() {
		s.installments(day("2025-03-20"), "card.itau", "travel.flights", "Latam Airlines", "Passagens São Paulo para Lisboa (ida e volta)", 560000, 10, "viagem-lisboa")
	})
	s.at(day("2025-04-02"), func() {
		s.foreign(day("2025-04-02"), "card.nubank", "travel.lodging", "Booking.com", "Hotel em Alfama, 9 noites", 124000, "6.2140")
	})
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
		{"2025-07-19", "food.restaurants", "Bar do Zé Pinheiros", "Petiscos e vinho no Bairro Alto", 4120},
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

// purchases are the large and the unusual card events of the history.
func (s *seeder) purchases() {
	// Florianópolis, January 2025.
	s.at(day("2024-11-26"), func() {
		s.installments(day("2024-11-26"), "card.itau", "travel.flights", "Azul Linhas Aéreas", "Passagens para Florianópolis (Black Friday)", 148000, 4, "viagem-florianopolis")
	})
	s.at(day("2024-12-12"), func() {
		s.installments(day("2024-12-12"), "card.nubank", "travel.lodging", "Airbnb", "Casa na Lagoa da Conceição, 6 noites", 225000, 3, "viagem-florianopolis")
	})
	s.trip("viagem-florianopolis", "2025-01-17", "2025-01-23", 14000, "card.itau", []place{
		{"Coco Bambu", "food.restaurants"}, {"Starbucks", "food.coffee"}, {"Uber", "transport.rideshare"}, {"Sympla", "travel.activities"}, {"Bar do Zé Pinheiros", "food.bars"},
	})

	s.lisbon()

	// Rio de Janeiro, April 2026.
	s.at(day("2026-02-24"), func() {
		s.installments(day("2026-02-24"), "card.itau", "travel.flights", "Latam Airlines", "Passagens para o Rio de Janeiro", 204000, 3, "viagem-rio")
	})
	s.at(day("2026-03-05"), func() {
		s.installments(day("2026-03-05"), "card.nubank", "travel.lodging", "Booking.com", "Hotel em Ipanema, 4 noites", 318000, 4, "viagem-rio")
	})
	s.trip("viagem-rio", "2026-04-17", "2026-04-21", 16000, "card.nubank", []place{
		{"Madero", "food.restaurants"}, {"Starbucks", "food.coffee"}, {"99", "transport.rideshare"}, {"Sympla", "travel.activities"}, {"Bar do Zé Pinheiros", "food.bars"},
	})

	// Black Friday 2025: the notebook is anticipated in 2026-09.
	var macbook string
	s.at(day("2025-11-28"), func() {
		_, macbook = s.installments(day("2025-11-28"), "card.itau", "shopping.electronics", "Apple", "MacBook Air 13 polegadas", 949900, 12, "black-friday")
	})
	s.at(day("2025-11-28"), func() {
		s.installments(day("2025-11-28"), "card.itau", "shopping.electronics", "KaBuM!", "Fone de ouvido com cancelamento de ruído", 129000, 3, "black-friday")
	})
	s.at(day("2026-09-02"), func() {
		s.do(http.MethodPost, "/installment-plans/"+macbook+"/anticipation", map[string]any{
			"date": "2026-09-02", "from_installment": 11, "to_installment": 12, "target_statement": "2026-09", "amount": brl(153566),
		}, nil)
	})

	s.at(day("2026-08-09"), func() {
		s.installments(day("2026-08-09"), "card.nubank", "housing.decor", "Tok&Stok", "Sofá de três lugares", 329000, 6)
	})

	// A return: the purchase is refunded in full.
	var zara string
	s.at(day("2025-03-08"), func() {
		zara = s.record("2025-03-08", "Vestido, Zara", map[string]any{"payee_id": s.id("payee.Zara")},
			post(s.id("card.itau"), -38990), post(s.id("shopping.clothes"), 38990))
	})
	s.at(day("2025-03-19"), func() {
		s.do(http.MethodPost, "/transactions/"+zara+"/refunds", map[string]any{"date": "2025-03-19", "amount": brl(38990)}, nil)
	})

	// A charge the owner did not recognize, disputed and won.
	var charge string
	s.at(day("2025-09-17"), func() {
		charge = s.record("2025-09-17", "Compra não reconhecida, Mercado Livre", map[string]any{"payee_id": s.id("payee.Mercado Livre")},
			post(s.id("card.nubank"), -61200), post(s.id("shopping.electronics"), 61200))
	})
	var dispute struct {
		ID string `json:"id"`
	}
	s.at(day("2025-09-19"), func() {
		s.do(http.MethodPost, "/transactions/"+charge+"/disputes", map[string]any{"opened_on": "2025-09-19"}, &dispute)
	})
	s.at(day("2025-10-20"), func() {
		s.do(http.MethodPost, "/disputes/"+dispute.ID+"/resolve", map[string]any{"resolved_on": "2025-10-20", "outcome": "won", "statement": "2025-11"}, nil)
	})

	// Yearly items.
	annual := []struct {
		date, via, category, payee, desc string
		cents                            int64
	}{
		{"2025-01-08", "card.itau", "leisure.streaming", "Amazon Prime", "Amazon Prime anual", 11900},
		{"2026-01-08", "card.itau", "leisure.streaming", "Amazon Prime", "Amazon Prime anual", 12900},
		{"2025-02-10", "card.itau", "education.courses", "Alura", "Assinatura anual da Alura", 149000},
		{"2026-02-10", "card.itau", "education.courses", "Alura", "Assinatura anual da Alura", 159000},
		{"2025-03-18", "card.nubank", "education.memberships", "Associação Brasileira de Product Management", "Anuidade da associação", 48000},
		{"2026-03-18", "card.nubank", "education.memberships", "Associação Brasileira de Product Management", "Anuidade da associação", 52000},
		{"2025-02-18", "card.nubank", "pets.vet", "Clínica Veterinária Patas", "Vacinas anuais", 18000},
		{"2025-09-12", "card.nubank", "pets.vet", "Clínica Veterinária Patas", "Limpeza de tártaro", 28500},
		{"2026-03-14", "card.nubank", "pets.vet", "Clínica Veterinária Patas", "Vacinas anuais", 19800},
		{"2026-09-10", "card.nubank", "pets.vet", "Clínica Veterinária Patas", "Consulta de rotina", 21000},
	}
	for _, a := range annual {
		s.at(day(a.date), func() { s.expense(day(a.date), a.via, a.category, a.payee, a.desc, a.cents) })
	}
}
