package main

// goals ties targets to the accounts that hold the savings for them. The emergency fund targets six months of spending; the CDB that matures in 2027-08 pays for the trip.
func (s *seeder) goals() {
	s.create("/goals", map[string]any{
		"name": "Reserva de emergência", "target": brl(11000000), "due_on": "2027-06-30",
		"account_ids": []string{s.id("nubank.reserve"), s.id("itau.savings"), s.id("sec.TSELIC29")},
	})
	s.create("/goals", map[string]any{
		"name": "Viagem ao Japão", "target": brl(5200000), "due_on": "2027-09-01",
		"account_ids": []string{s.id("sec.CDBXP27")},
	})
	s.create("/goals", map[string]any{
		"name":   "Entrada do apartamento",
		"target": brl(12000000),
		"due_on": "2030-01-01",
		"account_ids": []string{
			s.id("sec.ITUB4"),
			s.id("sec.WEGE3"),
			s.id("sec.HGLG11"),
			s.id("sec.KNRI11"),
			s.id("sec.TIPCA35"),
		},
	})
}
