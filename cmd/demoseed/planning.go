package main

import (
	"maps"
	"net/http"
	"slices"
	"time"
)

type scheduleSpec struct {
	key, kind, account, counterpart, payee, desc string
	cents                                        int64
	day, businessDay                             int
	start                                        string
	terms                                        map[string]int64 // effective date to amount
	until                                        string
	toleranceBP                                  int
}

// netSalary is the payroll deposit of a month, used as the expected amount of the salary schedule.
func netSalary(month time.Time) int64 {
	g := gross(month)
	inss := inssOf(month)

	return g - inss - irrfOf(g-inss, month) - healthPlanDiscount
}

// A past occurrence keeps the amount the schedule was created with, so a bill that differs from it by more than the default 10 % since the start fits only within a wider tolerance. Terms dated after the seeding day are announced changes.
func schedules(start time.Time) []scheduleSpec {
	s0 := iso(start)
	jan26 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	return []scheduleSpec{
		{key: "salary", kind: "income", account: "itau.checking", counterpart: "income.salary", payee: "Tarsus Tecnologia Ltda", desc: "Salário", cents: netSalary(start), businessDay: 5, start: s0,
			terms: map[string]int64{"2026-01-01": netSalary(jan26)}, toleranceBP: 1500},
		{key: "meal", kind: "income", account: "alelo.meal", counterpart: "income.meal", payee: "Alelo", desc: "Crédito Alelo Refeição", cents: 132000, businessDay: 1, start: s0,
			terms: map[string]int64{"2026-01-01": 143000}},
		{key: "rent", kind: "bill", account: "itau.checking", counterpart: "housing.rent", payee: "QuintoAndar", desc: "Aluguel", cents: 345000, day: 5, start: s0,
			terms: map[string]int64{"2025-08-01": 364000, "2026-08-01": 383000, "2027-08-01": 402000}, toleranceBP: 1500},
		{key: "condo", kind: "bill", account: "itau.checking", counterpart: "housing.condo", payee: "Condomínio Edifício Aurora", desc: "Condomínio", cents: 78000, day: 10, start: s0,
			terms: map[string]int64{"2025-05-01": 83500, "2026-05-01": 89000}, toleranceBP: 1500},
		{key: "electricity", kind: "bill", account: "itau.checking", counterpart: "housing.electricity", payee: "Enel SP", desc: "Conta de luz", cents: 22000, day: 18, start: s0, toleranceBP: 6500},
		{key: "water", kind: "bill", account: "itau.checking", counterpart: "housing.water", payee: "Sabesp", desc: "Conta de água", cents: 9800, day: 22, start: s0, toleranceBP: 3500},
		{key: "gas", kind: "bill", account: "nubank.checking", counterpart: "housing.gas", payee: "Comgás", desc: "Conta de gás", cents: 7200, day: 25, start: s0, toleranceBP: 5500},
		{key: "internet", kind: "subscription", account: "card.itau", counterpart: "housing.internet", payee: "Vivo Fibra", desc: "Internet fibra 500 mega", cents: 12990, day: 12, start: s0,
			terms: map[string]int64{"2025-06-01": 13990}},
		{key: "mobile", kind: "subscription", account: "card.nubank", counterpart: "housing.mobile", payee: "Vivo Móvel", desc: "Plano de celular", cents: 8990, day: 20, start: s0,
			terms: map[string]int64{"2025-09-01": 9990}, toleranceBP: 1500},
		{key: "gym", kind: "subscription", account: "card.nubank", counterpart: "health.gym", payee: "Smart Fit", desc: "Mensalidade da academia", cents: 11990, day: 8, start: s0}, // the fee rose to 12990 in 2025-09 and the schedule was never updated.
		{key: "netflix", kind: "subscription", account: "card.nubank", counterpart: "leisure.streaming", payee: "Netflix", desc: "Netflix", cents: 5590, day: 14, start: s0,
			terms: map[string]int64{"2025-11-01": 5990, "2026-12-01": 6490}},
		{key: "spotify", kind: "subscription", account: "card.itau", counterpart: "leisure.music", payee: "Spotify", desc: "Spotify Premium", cents: 2390, day: 6, start: s0,
			terms: map[string]int64{"2025-10-01": 2690}, toleranceBP: 1500},
		{key: "hbo", kind: "subscription", account: "card.nubank", counterpart: "leisure.streaming", payee: "HBO Max", desc: "HBO Max", cents: 3490, day: 17, start: s0, until: "2025-10-01"},
		{key: "disney", kind: "subscription", account: "card.itau", counterpart: "leisure.streaming", payee: "Disney+", desc: "Disney+", cents: 3390, day: 9, start: "2025-03-01"},
		{key: "pet", kind: "subscription", account: "card.nubank", counterpart: "pets.supplies", payee: "Petz", desc: "Assinatura de ração Petz", cents: 18990, day: 3, start: s0,
			terms: map[string]int64{"2025-08-01": 20990}, toleranceBP: 1500},
		{key: "donation", kind: "subscription", account: "card.itau", counterpart: "giving", payee: "Instituto Pequeno Cidadão", desc: "Doação mensal", cents: 5000, day: 28, start: s0},
		{key: "xp", kind: "savings", account: "itau.checking", counterpart: "xp.cash", desc: "Aporte mensal na XP", cents: 110000, businessDay: 6, start: s0},
		{key: "reserve", kind: "savings", account: "itau.checking", counterpart: "nubank.reserve", desc: "Aporte na caixinha de reserva", cents: 30000, businessDay: 6, start: s0},
	}
}

// priceInForce is the amount of the latest term of the schedule that has begun. A schedule is created today, so its occurrences of the past keep the amount it was created with: the one in force, which the recent months match exactly.
func (s *seeder) priceInForce(sp scheduleSpec) int64 {
	cents := sp.cents

	for _, from := range slices.Sorted(maps.Keys(sp.terms)) {
		if from <= iso(s.today) {
			cents = sp.terms[from]
		}
	}

	return cents
}

func (s *seeder) buildSchedules() {
	for _, sp := range schedules(s.start) {
		rec := map[string]any{"frequency": "monthly", "interval": 1, "start": sp.start}
		if sp.businessDay > 0 {
			rec["business_day_ordinal"] = sp.businessDay
		} else {
			rec["day_of_month"] = sp.day
		}

		body := map[string]any{
			"kind": sp.kind, "account_id": s.id(sp.account), "counterpart_id": s.id(sp.counterpart), "description": sp.desc,
			"amount": brl(s.priceInForce(sp)), "recurrence": rec,
		}
		if sp.payee != "" {
			body["payee_id"] = s.id("payee." + sp.payee)
		}

		if sp.toleranceBP > 0 {
			body["match_tolerance_bp"] = sp.toleranceBP
		}

		id := s.create("/schedules", body)

		s.ids["schedule."+sp.key] = id
		for _, from := range slices.Sorted(maps.Keys(sp.terms)) {
			if from > iso(s.today) {
				s.do(http.MethodPost, "/schedules/"+id+"/terms", map[string]any{"effective_from": from, "amount": brl(sp.terms[from])}, nil)
			}
		}

		if sp.until != "" {
			s.do(http.MethodPost, "/schedules/"+id+"/end", map[string]any{"from": sp.until}, nil)
		}
	}

	// The gym is paused while the owner travels in Portugal.
	s.do(http.MethodPost, "/schedules/"+s.id("schedule.gym")+"/pauses", map[string]any{"from": "2025-07-01", "to": "2025-07-31"}, nil)
}

// saveSavingsTarget sets the share of the average income that the owner sets aside, 20 %, on the plan of the current month.
func (s *seeder) saveSavingsTarget() {
	s.do(http.MethodPut, "/budget-plan?month="+ym(s.today), map[string]any{
		"source": "average_income", "savings_target_bp": 2000, "amounts": []any{},
	}, nil)
}

// reopenHistory makes every skipped occurrence of the past expected again. A recorded transaction that fits an occurrence realizes it on reopening, so the schedules read as kept since the first month.
func (s *seeder) reopenHistory() {
	end := s.today.AddDate(0, 0, -1)
	for from := s.start; !from.After(end); from = from.AddDate(0, 0, 360) {
		to := from.AddDate(0, 0, 359)
		if to.After(end) {
			to = end
		}

		var out struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?state=skipped&from="+iso(from)+"&to="+iso(to), nil, &out)

		for _, o := range out.Items {
			s.do(http.MethodPost, "/occurrences/"+o.ID+"/reopen", nil, nil)
			s.tolerate("validation_failed") // the date falls inside a pause of the schedule.
			s.tolerate("schedule_ended")    // the schedule ended before the date.
		}
	}
}

type budgetSpec struct {
	category string
	cents    int64
	rollover bool
	steps    map[string]int64 // amount from a month, "YYYY-MM"
}

// The budgets cover every category the persona spends in, the fixed ones as groups, so that no month leaves a large part of the spending unbudgeted.
var budgetSpecs = []budgetSpec{
	{"housing", 520000, false, map[string]int64{"2025-08": 545000, "2026-08": 575000}},
	{"health", 160000, false, map[string]int64{"2025-07": 175000}},
	{"system.taxes", 420000, false, map[string]int64{"2026-01": 440000}},
	{"system.fees", 10000, false, nil},
	{"food.groceries", 190000, true, map[string]int64{"2026-01": 200000}},
	{"food.produce", 35000, false, nil},
	{"food.bakery", 20000, false, nil},
	{"food.restaurants", 90000, false, map[string]int64{"2026-01": 95000}},
	{"food.delivery", 60000, false, nil},
	{"food.coffee", 25000, false, nil},
	{"food.bars", 40000, false, nil},
	{"transport.rideshare", 45000, false, map[string]int64{"2026-01": 50000}},
	{"shopping", 90000, true, map[string]int64{"2026-01": 95000}},
	{"leisure", 65000, false, nil},
	{"travel", 105000, true, map[string]int64{"2026-01": 115000}},
	{"pets", 45000, false, map[string]int64{"2026-01": 50000}},
	{"education", 25000, false, nil},
	{"giving", 5000, false, nil},
}

func (s *seeder) buildBudgets() {
	for _, b := range budgetSpecs {
		id := s.create("/budgets", map[string]any{"category_id": s.id(b.category), "amount": brl(b.cents), "effective_from": ym(s.start), "rollover": b.rollover})
		for _, from := range slices.Sorted(maps.Keys(b.steps)) {
			s.do(http.MethodPost, "/budgets/"+id+"/amounts", map[string]any{"effective_from": from, "amount": brl(b.steps[from])}, nil)
		}
	}
}
