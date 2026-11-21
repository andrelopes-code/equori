package main

// nubankTarget is the balance the owner brings the Nubank account to on payday, in cents.
const nubankTarget = 450000

// nubankTop returns the Pix, in whole hundreds of reais, that brings the Nubank account to its target; zero when it already holds more.
func nubankTop(balance int64) int64 {
	need := nubankTarget - balance
	if need < 50000 {
		return 0
	}

	return (need + 9999) / 10000 * 10000
}

// transfers are the monthly contributions to investments, the lump sums from the 13th salary and PLR, and the income tax refund.
func (s *seeder) transfers() {
	s.monthlyTransfers()
	s.lumpTransfers()
	s.taxRefunds()
}

func (s *seeder) monthlyTransfers() {
	for _, m := range months(s.start, s.today) {
		d := s.businessDay(m, 6)
		ted := contributionOn(monthsBetween(s.investStart(), m), m)

		s.at(d, func() {
			if top := nubankTop(s.bal[s.id("nubank.checking")]); top > 0 {
				s.ensure(d, "itau.checking", ted+30000+top)
				s.record(
					iso(d),
					"Pix para Nubank",
					map[string]any{"payee_id": s.id("payee.Nubank")},
					post(s.id("nubank.checking"), top),
					post(s.id("itau.checking"), -top),
				)
			}

			s.ensure(d, "itau.checking", ted+30000)
			s.record(
				iso(d),
				"TED para XP Investimentos",
				map[string]any{"payee_id": s.id("payee.XP Investimentos")},
				post(s.id("xp.cash"), ted),
				post(s.id("itau.checking"), -ted),
			)
			s.record(
				iso(d),
				"Aporte na caixinha de reserva",
				nil,
				post(s.id("nubank.reserve"), 30000),
				post(s.id("itau.checking"), -30000),
			)
		})
	}
}

func (s *seeder) lumpTransfers() {
	lump := func(date, desc string, cents int64) {
		d := day(date)
		s.at(d, func() {
			s.ensure(d, "itau.checking", cents)
			s.record(
				date,
				desc,
				map[string]any{"payee_id": s.id("payee.XP Investimentos")},
				post(s.id("xp.cash"), cents),
				post(s.id("itau.checking"), -cents),
			)
		})
	}
	// The 13th of 2025 goes to the dollar account instead (remittances).
	lump("2024-12-23", "TED para XP Investimentos, parte do 13º", 150000)
	lump("2025-03-17", "TED para XP Investimentos, parte da PLR", 600000)
	lump("2026-03-16", "TED para XP Investimentos, parte da PLR", 600000)
}

func (s *seeder) taxRefunds() {
	for _, r := range []struct {
		date  string
		cents int64
	}{{"2025-06-30", 284731}, {"2026-06-30", 196412}} {
		d := day(r.date)
		s.at(d, func() {
			s.record(
				r.date,
				"Restituição do imposto de renda",
				map[string]any{"payee_id": s.id("payee.Receita Federal")},
				post(s.id("itau.checking"), r.cents),
				post(s.id("income.refunds"), -r.cents),
			)
		})
	}
}
