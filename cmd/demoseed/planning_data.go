package main

import "time"

// A past occurrence keeps the amount the schedule was created with, so a bill that differs from it by more than the default 10 % since the start fits only within a wider tolerance. Terms dated after the seeding day are announced changes.
func schedules(start time.Time) []scheduleSpec {
	specs := scheduleIncome(start)
	specs = append(specs, scheduleBills(start)...)
	specs = append(specs, scheduleUtilities(start)...)
	specs = append(specs, scheduleConnectivity(start)...)
	specs = append(specs, scheduleSubscriptions(start)...)
	specs = append(specs, scheduleStreaming(start)...)
	specs = append(specs, scheduleDisney()...)
	specs = append(specs, scheduleHousehold(start)...)
	specs = append(specs, scheduleSavings(start)...)
	specs = append(specs, scheduleCar())

	return specs
}

func scheduleIncome(start time.Time) []scheduleSpec {
	s0 := iso(start)
	jan26 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	return []scheduleSpec{
		{
			key:         "salary",
			kind:        "income",
			account:     "itau.checking",
			counterpart: "income.salary",
			payee:       "Tarsus Tecnologia Ltda",
			desc:        "Salário",
			cents:       netSalary(start),
			businessDay: 5,
			start:       s0,
			terms:       map[string]int64{"2026-01-01": netSalary(jan26)},
			toleranceBP: 1500,
		},
		{
			key:         "meal",
			kind:        "income",
			account:     "alelo.meal",
			counterpart: "income.meal",
			payee:       "Alelo",
			desc:        "Crédito Alelo Refeição",
			cents:       132000,
			businessDay: 1,
			start:       s0,
			terms:       map[string]int64{"2026-01-01": 143000},
		},
	}
}

func scheduleBills(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "rent",
			kind:        "bill",
			account:     "itau.checking",
			counterpart: "housing.rent",
			payee:       "QuintoAndar",
			desc:        "Aluguel",
			cents:       345000,
			day:         5,
			start:       s0,
			terms: map[string]int64{
				"2025-08-01": 364000,
				"2026-08-01": 383000,
				"2027-08-01": 402000,
			},
			toleranceBP: 1500,
		},
		{
			key:         "condo",
			kind:        "bill",
			account:     "itau.checking",
			counterpart: "housing.condo",
			payee:       "Condomínio Edifício Aurora",
			desc:        "Condomínio",
			cents:       78000,
			day:         10,
			start:       s0,
			terms:       map[string]int64{"2025-05-01": 83500, "2026-05-01": 89000},
			toleranceBP: 1500,
		},
	}
}

func scheduleUtilities(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "electricity",
			kind:        "bill",
			account:     "itau.checking",
			counterpart: "housing.electricity",
			payee:       "Enel SP",
			desc:        "Conta de luz",
			cents:       22000,
			day:         18,
			start:       s0,
			toleranceBP: 6500,
		},
		{
			key:         "water",
			kind:        "bill",
			account:     "itau.checking",
			counterpart: "housing.water",
			payee:       "Sabesp",
			desc:        "Conta de água",
			cents:       9800,
			day:         22,
			start:       s0,
			toleranceBP: 3500,
		},
		{
			key:         "gas",
			kind:        "bill",
			account:     "nubank.checking",
			counterpart: "housing.gas",
			payee:       "Comgás",
			desc:        "Conta de gás",
			cents:       7200,
			day:         25,
			start:       s0,
			toleranceBP: 5500,
		},
	}
}

func scheduleConnectivity(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "internet",
			kind:        "subscription",
			account:     "card.itau",
			counterpart: "housing.internet",
			payee:       "Vivo Fibra",
			desc:        "Internet fibra 500 mega",
			cents:       12990,
			day:         12,
			start:       s0,
			terms:       map[string]int64{"2025-06-01": 13990},
		},
		{
			key:         "mobile",
			kind:        "subscription",
			account:     "card.nubank",
			counterpart: "housing.mobile",
			payee:       "Vivo Móvel",
			desc:        "Plano de celular",
			cents:       8990,
			day:         20,
			start:       s0,
			terms:       map[string]int64{"2025-09-01": 9990},
			toleranceBP: 1500,
		},
	}
}

func scheduleSubscriptions(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "gym",
			kind:        "subscription",
			account:     "card.nubank",
			counterpart: "health.gym",
			payee:       "Smart Fit",
			desc:        "Mensalidade da academia",
			cents:       11990,
			day:         8,
			start:       s0,
		}, // the fee rose to 12990 in 2025-09 and the schedule was never updated.
	}
}

func scheduleStreaming(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "netflix",
			kind:        "subscription",
			account:     "card.nubank",
			counterpart: "leisure.streaming",
			payee:       "Netflix",
			desc:        "Netflix",
			cents:       5590,
			day:         14,
			start:       s0,
			terms:       map[string]int64{"2025-11-01": 5990, "2026-12-01": 6490},
		},
		{
			key:         "spotify",
			kind:        "subscription",
			account:     "card.itau",
			counterpart: "leisure.music",
			payee:       "Spotify",
			desc:        "Spotify Premium",
			cents:       2390,
			day:         6,
			start:       s0,
			terms:       map[string]int64{"2025-10-01": 2690},
			toleranceBP: 1500,
		},
		{
			key:         "hbo",
			kind:        "subscription",
			account:     "card.nubank",
			counterpart: "leisure.streaming",
			payee:       "HBO Max",
			desc:        "HBO Max",
			cents:       3490,
			day:         17,
			start:       s0,
			until:       "2025-10-01",
		},
	}
}

func scheduleDisney() []scheduleSpec {
	return []scheduleSpec{
		{
			key:         "disney",
			kind:        "subscription",
			account:     "card.itau",
			counterpart: "leisure.streaming",
			payee:       "Disney+",
			desc:        "Disney+",
			cents:       3390,
			day:         9,
			start:       "2025-03-01",
		},
	}
}

func scheduleHousehold(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "pet",
			kind:        "subscription",
			account:     "card.nubank",
			counterpart: "pets.supplies",
			payee:       "Petz",
			desc:        "Assinatura de ração Petz",
			cents:       18990,
			day:         3,
			start:       s0,
			terms:       map[string]int64{"2025-08-01": 20990},
			toleranceBP: 1500,
		},
		{
			key:         "donation",
			kind:        "subscription",
			account:     "card.itau",
			counterpart: "giving",
			payee:       "Instituto Pequeno Cidadão",
			desc:        "Doação mensal",
			cents:       5000,
			day:         28,
			start:       s0,
		},
	}
}

func scheduleSavings(start time.Time) []scheduleSpec {
	s0 := iso(start)

	return []scheduleSpec{
		{
			key:         "xp",
			kind:        "savings",
			account:     "itau.checking",
			counterpart: "xp.cash",
			desc:        "Aporte mensal na XP",
			cents:       110000,
			businessDay: 6,
			start:       s0,
			until:       contributionCut + "-01",
		},
		// The installments of the car cut the contribution: a new schedule takes over from the old one.
		{
			key:         "xp.car",
			kind:        "savings",
			account:     "itau.checking",
			counterpart: "xp.cash",
			desc:        "Aporte mensal na XP",
			cents:       contributionAfterCar,
			businessDay: 6,
			start:       contributionCut + "-01",
		},
		{
			key:         "reserve",
			kind:        "savings",
			account:     "itau.checking",
			counterpart: "nubank.reserve",
			desc:        "Aporte na caixinha de reserva",
			cents:       30000,
			businessDay: 6,
			start:       s0,
		},
	}
}

type budgetSpec struct {
	category string
	cents    int64
	rollover bool
	steps    map[string]int64 // amount from a month, "YYYY-MM"
}

var budgetSpecs = []budgetSpec{
	{"housing", 520000, false, map[string]int64{"2025-08": 545000, "2026-08": 575000}},
	{"health", 160000, false, map[string]int64{"2025-07": 175000}},
	{"system.taxes", 420000, false, map[string]int64{"2026-01": 440000}},
	{"system.fees", 10000, false, nil},
	{"food.groceries", 95000, false, map[string]int64{"2026-01": 100000}},
	{"food.produce", 24000, false, nil},
	{"food.bakery", 14000, false, nil},
	{"food.restaurants", 90000, false, map[string]int64{"2026-01": 95000}},
	{"food.delivery", 48000, false, nil},
	{"food.coffee", 17000, false, nil},
	{"food.bars", 50000, false, nil},
	{"transport.rideshare", 25000, false, map[string]int64{"2025-09": 12000, "2026-01": 13000}},
	{"shopping", 90000, true, map[string]int64{"2026-01": 95000}},
	{"leisure", 45000, false, nil},
	{"travel", 105000, true, map[string]int64{"2026-01": 115000}},
	{"pets", 33000, false, map[string]int64{"2026-01": 36000}},
	{"education", 25000, false, nil},
	{"giving", 5000, false, nil},
}

// scheduleCar is the installment of the financing of the car, a transfer to the financing on the 15th until the
// 48th; the interest of each installment rides on the same transaction.
func scheduleCar() scheduleSpec {
	last := day(carPurchase).AddDate(0, carInstallments, 1)

	return scheduleSpec{
		key:         "car.loan",
		kind:        "transfer",
		account:     "itau.checking",
		counterpart: "car.loan",
		payee:       "Itaú Unibanco",
		desc:        "Parcela do financiamento do HB20",
		cents:       carInstallment,
		day:         15,
		start:       iso(day(carPurchase).AddDate(0, 1, 0)),
		until:       iso(last),
	}
}
