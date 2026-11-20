package main

import (
	"strings"
	"time"
)

// expense records a purchase of cents in category paid through via: a card, a checking account, the wallet or the meal benefit.
func (s *seeder) expense(
	d time.Time,
	via, category, payee, desc string,
	cents int64,
	tags ...string,
) {
	if via == "alelo.meal" && s.bal[s.id(via)] < cents {
		via = "card.nubank"
	}

	// The meal card is spent first on food it is accepted for, so that the credit of the month does not pile up.
	if strings.HasPrefix(category, "food.") && category != "food.bars" && via != "wallet" &&
		s.bal[s.id("alelo.meal")] >= cents+mealReserve {
		via = "alelo.meal"
	}

	if !strings.HasPrefix(via, "card.") {
		s.ensure(d, via, cents)
	}

	if s.feed(d, via, payee, cents, tags) {
		return
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

// mealReserve is the balance of the meal card that a purchase leaves for the next one, in cents.
const mealReserve = 30000

func (s *seeder) payroll(month time.Time) {
	g := gross(month)
	inss := inssOf(month)
	irrf := irrfOf(g-inss, month)
	net := g - inss - irrf - healthPlanDiscount
	s.at(s.businessDay(month, 5), func() {
		s.record(
			iso(s.businessDay(month, 5)),
			"Salário "+ym(month),
			map[string]any{"payee_id": s.id("payee.Tarsus Tecnologia Ltda")},
			post(
				s.id("income.salary"),
				-g,
			),
			post(s.id("tax.inss"), inss),
			post(s.id("tax.irrf"), irrf),
			post(s.id("health.plan"), healthPlanDiscount),
			post(s.id("itau.checking"), net),
		)
	})
	meal := step(month, 132000, map[string]int64{"2026-01": 143000})
	s.at(s.businessDay(month, 1), func() {
		s.record(
			iso(s.businessDay(month, 1)),
			"Crédito Alelo Refeição "+ym(month),
			map[string]any{"payee_id": s.id("payee.Alelo")},
			post(s.id("alelo.meal"), meal),
			post(s.id("income.meal"), -meal),
		)
	})
}

// extras are the yearly payments of the employer and the occasional income.
func (s *seeder) extras() {
	s.extrasEmployer()
	s.extrasFreelance()
	s.extrasRefunds()
}

func (s *seeder) extrasEmployer() {
	s.extrasThirteenth()
	s.extrasVacationAndBonus()
}

func (s *seeder) extrasThirteenth() {
	// First installment of the 13th salary has no withholding; the second carries the tax of the whole.
	s.payslip(
		"2024-11-28",
		"13º salário, 1ª parcela 2024",
		"income.thirteenth",
		745000,
		0,
		0,
		"itau.checking",
	)
	s.payslip(
		"2024-12-20",
		"13º salário, 2ª parcela 2024",
		"income.thirteenth",
		745000,
		inss2024,
		irrfOf(1490000-inss2024, time.Date(2024, 12, 1, 0, 0, 0, 0, time.UTC)),
		"itau.checking",
	)
	s.payslip(
		"2025-11-28",
		"13º salário, 1ª parcela 2025",
		"income.thirteenth",
		745000,
		0,
		0,
		"itau.checking",
	)
	s.payslip(
		"2025-12-19",
		"13º salário, 2ª parcela 2025",
		"income.thirteenth",
		745000,
		inss2025,
		irrfOf(1490000-inss2025, time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC)),
		"itau.checking",
	)
}

func (s *seeder) extrasVacationAndBonus() {
	// The constitutional third of the vacation; the monthly salary already reached the INSS ceiling.
	s.payslip(
		"2025-07-02",
		"Adicional de férias (1/3)",
		"income.vacation",
		496667,
		0,
		496667*275/1000,
		"itau.checking",
	)
	// PLR is taxed apart from the salary; 17 % is an approximate effective rate.
	s.payslip("2025-03-14", "PLR 2024", "income.bonus", 1380000, 0, 1380000*17/100, "itau.checking")
	s.payslip("2026-03-13", "PLR 2025", "income.bonus", 1530000, 0, 1530000*17/100, "itau.checking")
}

// payslip records one employer payment: the gross income, the withheld taxes and the net deposit.
func (s *seeder) payslip(
	d, desc, income string,
	g, inss, irrf int64,
	account string,
) {
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
		s.record(
			d,
			desc,
			map[string]any{"payee_id": s.id("payee.Tarsus Tecnologia Ltda")},
			ps...)
	})
}

func (s *seeder) extrasFreelance() {
	free := func(d, desc string, cents int64) {
		day, _ := time.Parse(time.DateOnly, d)
		s.at(day, func() {
			s.record(
				d,
				desc,
				map[string]any{"tags": []string{"trabalho-extra"}},
				post(s.id("nubank.checking"), cents),
				post(s.id("income.freelance"), -cents),
			)
		})
	}
	free("2025-04-11", "Consultoria de discovery para startup", 320000)
	free("2025-10-09", "Workshop de priorização de produto", 240000)
	free("2026-05-15", "Mentoria e revisão de roadmap", 410000)
	free("2026-08-21", "Palestra em meetup de produto", 180000)
}

func (s *seeder) extrasRefunds() {
	refund := func(d, desc, payee string, cents int64, tags ...string) {
		day, _ := time.Parse(time.DateOnly, d)
		s.at(day, func() {
			extra := map[string]any{"payee_id": s.id("payee." + payee)}
			if len(tags) > 0 {
				extra["tags"] = tags
			}

			s.record(
				d,
				desc,
				extra,
				post(s.id("itau.checking"), cents),
				post(s.id("income.refunds"), -cents),
			)
		})
	}
	refund(
		"2025-05-23",
		"Reembolso de viagem a trabalho, São Paulo para Recife",
		"Tarsus Tecnologia Ltda",
		148620,
		"trabalho",
	)
	refund(
		"2025-11-14",
		"Reembolso de transporte do evento de produto",
		"Tarsus Tecnologia Ltda",
		48630,
		"trabalho",
	)
	refund(
		"2026-06-20",
		"Reembolso de curso aprovado pela empresa",
		"Tarsus Tecnologia Ltda",
		129000,
		"trabalho",
	)
	refund("2025-06-12", "Reembolso de consulta, plano de saúde", "Bradesco Saúde", 28000)
	refund("2026-04-15", "Reembolso de consulta, plano de saúde", "Bradesco Saúde", 31500)
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
		s.at(onDay(m, 27), func() { s.flushFeed("nubank.checking") })
		s.cashback(m)
		s.payroll(m)
		s.fixedBills(m)
		s.spending(m)
		s.statementPayments(m)
	}

	s.extras()
	s.purchases()
	s.teachRules()
	s.transfers()
	// An action runs before the trades of its date: units bought on the first day without the right are not split.
	s.corporateActions()
	s.contributions()
	s.earmarked()
	s.applyFixedIncome()
	s.trims()
	s.income()
	s.snapshots()
}

// cashback is the credit of the Nubank card, a little under 1 % of its month, paid into the account on the 12th.
func (s *seeder) cashback(month time.Time) {
	d := onDay(month, 12)
	cents := s.between(500, 2500, 1)

	s.at(d, func() {
		s.record(
			iso(d),
			"Cashback do cartão Nubank",
			map[string]any{"payee_id": s.id("payee.Nubank")},
			post(s.id("nubank.checking"), cents),
			post(s.id("income.cashback"), -cents),
		)
	})
}
