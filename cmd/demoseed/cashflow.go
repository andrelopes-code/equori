package main

import (
	"strings"
	"time"
)

// expense records a purchase of cents in category paid through via: a card, a checking account, the wallet or the meal benefit.
func (s *seeder) expense(d time.Time, via, category, payee, desc string, cents int64, tags ...string) {
	if via == "alelo.meal" && s.bal[s.id(via)] < cents {
		via = "card.nubank"
	}
	if !strings.HasPrefix(via, "card.") {
		s.ensure(d, via, cents)
	}
	extra := map[string]any{}
	if payee != "" {
		extra["payee_id"] = s.id("payee." + payee)
	}
	if len(tags) > 0 {
		extra["tags"] = tags
	}
	s.record(iso(d), desc, extra, post(s.id(via), -cents), post(s.id(category), cents))
}

// Payroll of Tarsus Tecnologia. Amounts are in cents.
const (
	healthPlanDiscount = 31240
	inss2024           = 87724 // maximum monthly contribution of the year
	inss2025           = 95162
	inss2026           = 98809
)

func gross(month time.Time) int64 {
	return step(month, 1490000, map[string]int64{"2026-01": 1580000})
}

func inssOf(month time.Time) int64 {
	switch month.Year() {
	case 2024:
		return inss2024
	case 2025:
		return inss2025
	default:
		return inss2026
	}
}

// irrfOf applies the 27.5 % bracket with its deduction; every salary of the persona falls in it.
func irrfOf(base int64, month time.Time) int64 {
	deduction := int64(89600)
	if ym(month) >= "2025-05" {
		deduction = 90873
	}
	return base*275/1000 - deduction
}

func (s *seeder) payroll(month time.Time) {
	g := gross(month)
	inss := inssOf(month)
	irrf := irrfOf(g-inss, month)
	net := g - inss - irrf - healthPlanDiscount
	s.at(businessDay(month, 5), func() {
		s.record(iso(businessDay(month, 5)), "Salário "+ym(month), map[string]any{"payee_id": s.id("payee.Tarsus Tecnologia Ltda")},
			post(s.id("income.salary"), -g), post(s.id("tax.inss"), inss), post(s.id("tax.irrf"), irrf),
			post(s.id("health.plan"), healthPlanDiscount), post(s.id("itau.checking"), net))
	})
	meal := step(month, 132000, map[string]int64{"2026-01": 143000})
	s.at(businessDay(month, 1), func() {
		s.record(iso(businessDay(month, 1)), "Crédito Alelo Refeição "+ym(month), map[string]any{"payee_id": s.id("payee.Alelo")},
			post(s.id("alelo.meal"), meal), post(s.id("income.meal"), -meal))
	})
}

// extras are the yearly payments of the employer and the occasional income.
func (s *seeder) extras() {
	p := func(d, desc, income string, g, inss, irrf int64, account string) {
		day, _ := time.Parse(time.DateOnly, d)
		s.at(day, func() {
			ps := []posting{post(s.id(income), -g)}
			if inss > 0 {
				ps = append(ps, post(s.id("tax.inss"), inss))
			}
			if irrf > 0 {
				ps = append(ps, post(s.id("tax.irrf"), irrf))
			}
			ps = append(ps, post(s.id(account), g-inss-irrf))
			s.record(d, desc, map[string]any{"payee_id": s.id("payee.Tarsus Tecnologia Ltda")}, ps...)
		})
	}
	// First installment of the 13th salary has no withholding; the second carries the tax of the whole.
	p("2024-11-28", "13º salário, 1ª parcela 2024", "income.thirteenth", 745000, 0, 0, "itau.checking")
	p("2024-12-20", "13º salário, 2ª parcela 2024", "income.thirteenth", 745000, inss2024, irrfOf(1490000-inss2024, time.Date(2024, 12, 1, 0, 0, 0, 0, time.UTC)), "itau.checking")
	p("2025-11-28", "13º salário, 1ª parcela 2025", "income.thirteenth", 745000, 0, 0, "itau.checking")
	p("2025-12-19", "13º salário, 2ª parcela 2025", "income.thirteenth", 745000, inss2025, irrfOf(1490000-inss2025, time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC)), "itau.checking")
	// The constitutional third of the vacation; the monthly salary already reached the INSS ceiling.
	p("2025-07-02", "Adicional de férias (1/3)", "income.vacation", 496667, 0, 496667*275/1000, "itau.checking")
	// PLR is taxed apart from the salary; 17 % is an approximate effective rate.
	p("2025-03-14", "PLR 2024", "income.bonus", 1380000, 0, 1380000*17/100, "itau.checking")
	p("2026-03-13", "PLR 2025", "income.bonus", 1530000, 0, 1530000*17/100, "itau.checking")

	free := func(d, desc string, cents int64) {
		day, _ := time.Parse(time.DateOnly, d)
		s.at(day, func() {
			s.record(d, desc, map[string]any{"tags": []string{"trabalho-extra"}}, post(s.id("nubank.checking"), cents), post(s.id("income.freelance"), -cents))
		})
	}
	free("2025-04-11", "Consultoria de discovery para startup", 320000)
	free("2025-10-09", "Workshop de priorização de produto", 240000)
	free("2026-05-15", "Mentoria e revisão de roadmap", 410000)
	free("2026-08-21", "Palestra em meetup de produto", 180000)

	refund := func(d, desc string, cents int64) {
		day, _ := time.Parse(time.DateOnly, d)
		s.at(day, func() {
			s.record(d, desc, map[string]any{"payee_id": s.id("payee.Tarsus Tecnologia Ltda"), "tags": []string{"trabalho"}},
				post(s.id("itau.checking"), cents), post(s.id("income.refunds"), -cents))
		})
	}
	refund("2025-05-23", "Reembolso de viagem a trabalho, São Paulo para Recife", 148620)
	refund("2025-11-14", "Reembolso de transporte do evento de produto", 48630)
	refund("2026-06-20", "Reembolso de curso aprovado pela empresa", 129000)
}

type bill struct {
	category, payee, via, desc string
	day                        int
	base                       int64
	steps                      map[string]int64
	noise                      float64
	seasonal                   *[12]float64
	from, until                string
	tags                       []string
}

var (
	electricitySeason = [12]float64{1.25, 1.3, 1.2, 1.05, .95, .9, .9, .85, .95, 1.05, 1.15, 1.2}
	gasSeason         = [12]float64{.8, .8, .85, .95, 1.1, 1.3, 1.35, 1.3, 1.1, .95, .85, .8}
)

var bills = []bill{
	{category: "housing.rent", payee: "QuintoAndar", via: "itau.checking", desc: "Aluguel", day: 5, base: 345000, steps: map[string]int64{"2025-08": 364000, "2026-08": 383000}},
	{category: "housing.condo", payee: "Condomínio Edifício Aurora", via: "itau.checking", desc: "Condomínio", day: 10, base: 78000, steps: map[string]int64{"2025-05": 83500, "2026-05": 89000}},
	{category: "housing.electricity", payee: "Enel SP", via: "itau.checking", desc: "Conta de luz", day: 18, base: 22000, steps: map[string]int64{"2025-07": 23800, "2026-07": 25200}, noise: 8, seasonal: &electricitySeason},
	{category: "housing.water", payee: "Sabesp", via: "itau.checking", desc: "Conta de água", day: 22, base: 9800, steps: map[string]int64{"2025-02": 10600, "2026-02": 11300}, noise: 10},
	{category: "housing.gas", payee: "Comgás", via: "nubank.checking", desc: "Conta de gás", day: 25, base: 7200, noise: 9, seasonal: &gasSeason},
	{category: "housing.internet", payee: "Vivo Fibra", via: "card.itau", desc: "Internet fibra 500 mega", day: 12, base: 12990, steps: map[string]int64{"2025-06": 13990}},
	{category: "housing.mobile", payee: "Vivo Móvel", via: "card.nubank", desc: "Plano de celular", day: 20, base: 8990, steps: map[string]int64{"2025-09": 9990}},
	{category: "health.gym", payee: "Smart Fit", via: "card.nubank", desc: "Mensalidade da academia", day: 8, base: 11990, steps: map[string]int64{"2025-09": 12990}},
	{category: "leisure.streaming", payee: "Netflix", via: "card.nubank", desc: "Netflix", day: 14, base: 5590, steps: map[string]int64{"2025-11": 5990}},
	{category: "leisure.music", payee: "Spotify", via: "card.itau", desc: "Spotify Premium", day: 6, base: 2390, steps: map[string]int64{"2025-10": 2690}},
	{category: "leisure.streaming", payee: "HBO Max", via: "card.nubank", desc: "HBO Max", day: 17, base: 3490, until: "2025-09"},
	{category: "leisure.streaming", payee: "Disney+", via: "card.itau", desc: "Disney+", day: 9, base: 3390, from: "2025-03"},
	{category: "pets.supplies", payee: "Petz", via: "card.nubank", desc: "Assinatura de ração Petz", day: 3, base: 18990, steps: map[string]int64{"2025-08": 20990}, tags: []string{"gato"}},
	{category: "giving", payee: "Instituto Pequeno Cidadão", via: "card.itau", desc: "Doação mensal", day: 28, base: 5000},
	{category: "fee.card", payee: "Itaú Unibanco", via: "card.itau", desc: "Anuidade do cartão Platinum", day: 21, base: 6240},
	{category: "fee.bank", payee: "Itaú Unibanco", via: "itau.checking", desc: "Pacote de serviços da conta", day: 2, base: 3860},
}

func (s *seeder) fixedBills(month time.Time) {
	for _, b := range bills {
		if (b.from != "" && ym(month) < b.from) || (b.until != "" && ym(month) > b.until) {
			continue
		}
		cents := step(month, b.base, b.steps)
		if b.seasonal != nil {
			cents = int64(float64(cents) * b.seasonal[month.Month()-1])
		}
		if b.noise > 0 {
			cents = s.jitter(cents, b.noise)
		}
		d := onDay(month, b.day)
		s.at(d, func() { s.expense(d, b.via, b.category, b.payee, b.desc, cents, b.tags...) })
	}
}

func (s *seeder) cashflow() {
	for _, m := range months(s.start, s.today) {
		s.payroll(m)
		s.fixedBills(m)
		s.spending(m)
		s.statementPayments(m)
	}
	s.extras()
	s.purchases()
	s.transfers()
	s.trades()
	s.income()
	s.snapshots()
}
