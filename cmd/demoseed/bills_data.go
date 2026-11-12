package main

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
	{
		category: "housing.rent",
		payee:    "QuintoAndar",
		via:      "itau.checking",
		desc:     "Aluguel",
		day:      5,
		base:     345000,
		steps:    map[string]int64{"2025-08": 364000, "2026-08": 383000},
	},
	{
		category: "housing.condo",
		payee:    "Condomínio Edifício Aurora",
		via:      "itau.checking",
		desc:     "Condomínio",
		day:      10,
		base:     78000,
		steps:    map[string]int64{"2025-05": 83500, "2026-05": 89000},
	},
	{
		category: "housing.electricity",
		payee:    "Enel SP",
		via:      "itau.checking",
		desc:     "Conta de luz",
		day:      18,
		base:     22000,
		steps:    map[string]int64{"2025-07": 23800, "2026-07": 25200},
		noise:    8,
		seasonal: &electricitySeason,
	},
	{
		category: "housing.water",
		payee:    "Sabesp",
		via:      "itau.checking",
		desc:     "Conta de água",
		day:      22,
		base:     9800,
		steps:    map[string]int64{"2025-02": 10600, "2026-02": 11300},
		noise:    10,
	},
	{
		category: "housing.gas",
		payee:    "Comgás",
		via:      "nubank.checking",
		desc:     "Conta de gás",
		day:      25,
		base:     7200,
		noise:    9,
		seasonal: &gasSeason,
	},
	{
		category: "housing.internet",
		payee:    "Vivo Fibra",
		via:      "card.itau",
		desc:     "Internet fibra 500 mega",
		day:      12,
		base:     12990,
		steps:    map[string]int64{"2025-06": 13990},
	},
	{
		category: "housing.mobile",
		payee:    "Vivo Móvel",
		via:      "card.nubank",
		desc:     "Plano de celular",
		day:      20,
		base:     8990,
		steps:    map[string]int64{"2025-09": 9990},
	},
	{
		category: "health.gym",
		payee:    "Smart Fit",
		via:      "card.nubank",
		desc:     "Mensalidade da academia",
		day:      8,
		base:     11990,
		steps:    map[string]int64{"2025-09": 12990},
	},
	{
		category: "leisure.streaming",
		payee:    "Netflix",
		via:      "card.nubank",
		desc:     "Netflix",
		day:      14,
		base:     5590,
		steps:    map[string]int64{"2025-11": 5990},
	},
	{
		category: "leisure.music",
		payee:    "Spotify",
		via:      "card.itau",
		desc:     "Spotify Premium",
		day:      6,
		base:     2390,
		steps:    map[string]int64{"2025-10": 2690},
	},
	{
		category: "leisure.streaming",
		payee:    "HBO Max",
		via:      "card.nubank",
		desc:     "HBO Max",
		day:      17,
		base:     3490,
		until:    "2025-09",
	},
	{
		category: "leisure.streaming",
		payee:    "Disney+",
		via:      "card.itau",
		desc:     "Disney+",
		day:      9,
		base:     3390,
		from:     "2025-03",
	},
	{
		category: "pets.supplies",
		payee:    "Petz",
		via:      "card.nubank",
		desc:     "Assinatura de ração Petz",
		day:      3,
		base:     18990,
		steps:    map[string]int64{"2025-08": 20990},
		tags:     []string{"gato"},
	},
	{
		category: "leisure.apps",
		payee:    "Apple",
		via:      "card.itau",
		desc:     "iCloud+ 200 GB",
		day:      15,
		base:     1490,
		steps:    map[string]int64{"2026-03": 1690},
	},
	{
		category: "education.courses",
		payee:    "Duolingo",
		via:      "card.nubank",
		desc:     "Duolingo Super",
		day:      23,
		base:     4990,
		from:     "2025-06",
	},
	{
		category: "giving",
		payee:    "Instituto Pequeno Cidadão",
		via:      "card.itau",
		desc:     "Doação mensal",
		day:      28,
		base:     5000,
	},
	{
		category: "fee.card",
		payee:    "Itaú Unibanco",
		via:      "card.itau",
		desc:     "Anuidade do cartão Platinum",
		day:      21,
		base:     6240,
	},
	{
		category: "fee.bank",
		payee:    "Itaú Unibanco",
		via:      "itau.checking",
		desc:     "Pacote de serviços da conta",
		day:      2,
		base:     3860,
	},
}
