package main

type institution struct {
	key, name, scheme, identifier string
}

// Identifiers are the ISPB codes of the institutions, the br_ispb scheme of ADR 013.
var institutions = []institution{
	{"itau", "Itaú Unibanco", "br_ispb", "60701190"},
	{"nubank", "Nubank", "br_ispb", "18236120"},
	{"xp", "XP Investimentos", "br_ispb", "02332886"},
	{"alelo", "Alelo", "", ""},
}

type account struct {
	key, name, class, kind string
	parent, institution    string
	opening                int64
	yield                  bool
	color                  int
}

// Accounts in creation order: a parent precedes its children. opening is the balance on the first day of the history, in cents.
var accounts = []account{
	{key: "itau", name: "Itaú", class: "asset", kind: "checking", institution: "itau", color: 2},
	{
		key:         "itau.checking",
		name:        "Conta corrente Itaú",
		class:       "asset",
		kind:        "checking",
		parent:      "itau",
		institution: "itau",
		opening:     438672,
		color:       2,
	},
	{
		key:         "itau.savings",
		name:        "Poupança Itaú",
		class:       "asset",
		kind:        "savings",
		parent:      "itau",
		institution: "itau",
		opening:     1125000,
		yield:       true,
		color:       2,
	},
	{
		key:         "nubank",
		name:        "Nubank",
		class:       "asset",
		kind:        "checking",
		institution: "nubank",
		color:       6,
	},
	{
		key:         "nubank.checking",
		name:        "Conta Nubank",
		class:       "asset",
		kind:        "checking",
		parent:      "nubank",
		institution: "nubank",
		opening:     184219,
		color:       6,
	},
	{
		key:         "nubank.reserve",
		name:        "Caixinha reserva de emergência",
		class:       "asset",
		kind:        "reserve",
		parent:      "nubank",
		institution: "nubank",
		opening:     2130000,
		yield:       true,
		color:       6,
	},
	{
		key:         "xp",
		name:        "XP Investimentos",
		class:       "asset",
		kind:        "brokerage",
		institution: "xp",
		color:       4,
	},
	{
		key:         "xp.cash",
		name:        "Saldo em conta XP",
		class:       "asset",
		kind:        "brokerage",
		parent:      "xp",
		institution: "xp",
		color:       4,
	},
	{
		key:         "alelo.meal",
		name:        "Alelo Refeição",
		class:       "asset",
		kind:        "benefit",
		institution: "alelo",
		color:       3,
	},
	{key: "wallet", name: "Carteira", class: "asset", kind: "cash", opening: 21500, color: 5},
	{
		key:   "receivable.rafael",
		name:  "A receber: Rafael",
		class: "asset",
		kind:  "receivable",
		color: 7,
	},
}

type card struct {
	key, name, institution string
	color                  int
	plastics               []plastic
	rules                  []map[string]any
	limits                 []map[string]any
}

type plastic struct {
	lastFour string
	virtual  bool
}

// Itaú closes on a fixed day; Nubank closes a number of days before the due date and moves its due day in 2026-04.
var cards = []card{
	{
		key: "card.itau", name: "Itaú Visa Platinum", institution: "itau", color: 2,
		plastics: []plastic{{"4812", false}, {"9033", true}},
		rules: []map[string]any{
			{
				"effective_from":         "2024-11",
				"closing_mode":           "day",
				"closing_day":            3,
				"due_day":                10,
				"closing_day_assignment": "next",
			},
		},
		limits: []map[string]any{
			{"effective_from": "2024-11-01", "amount": brl(1800000)},
			{"effective_from": "2025-09-15", "amount": brl(2400000)},
		},
	},
	{
		key: "card.nubank", name: "Nubank Mastercard", institution: "nubank", color: 6,
		plastics: []plastic{{"7741", false}},
		rules: []map[string]any{
			{
				"effective_from":          "2024-11",
				"closing_mode":            "before_due",
				"closing_days_before_due": 7,
				"due_day":                 12,
			},
			{
				"effective_from":          "2026-04",
				"closing_mode":            "before_due",
				"closing_days_before_due": 7,
				"due_day":                 17,
			},
		},
		limits: []map[string]any{
			{"effective_from": "2024-11-01", "amount": brl(950000)},
			{"effective_from": "2026-02-10", "amount": brl(1400000)},
		},
	},
}

type category struct {
	key, name, icon string
	color           int
	children        []category
}

func leaf(key, name, icon string) category { return category{key: key, name: name, icon: icon} }

var expenseCategories = []category{
	{key: "housing", name: "Moradia", icon: "house", color: 1, children: []category{
		leaf("housing.rent", "Aluguel", "key-round"),
		leaf("housing.condo", "Condomínio", "building-2"),
		leaf("housing.electricity", "Energia elétrica", "zap"),
		leaf("housing.water", "Água e esgoto", "droplet"),
		leaf("housing.gas", "Gás", "flame"),
		leaf("housing.internet", "Internet", "wifi"),
		leaf("housing.mobile", "Celular", "smartphone"),
		leaf("housing.repairs", "Manutenção e reparos", "wrench"),
		leaf("housing.decor", "Casa e decoração", "sofa"),
	}},
	{key: "food", name: "Alimentação", icon: "utensils", color: 2, children: []category{
		leaf("food.groceries", "Mercado", "shopping-cart"),
		leaf("food.produce", "Feira e hortifrúti", "apple"),
		leaf("food.bakery", "Padaria", "croissant"),
		leaf("food.restaurants", "Restaurantes", "utensils"),
		leaf("food.delivery", "Delivery", "pizza"),
		leaf("food.coffee", "Café e lanches", "coffee"),
		leaf("food.bars", "Bares", "beer"),
	}},
	{key: "transport", name: "Transporte", icon: "car-taxi-front", color: 3, children: []category{
		leaf("transport.rideshare", "Aplicativo de transporte", "car-taxi-front"),
		leaf("transport.transit", "Transporte público", "bus"),
		leaf("transport.coach", "Viagens de ônibus", "train-front"),
		leaf("transport.bike", "Bicicleta compartilhada", "bike"),
	}},
	{key: "health", name: "Saúde", icon: "heart-pulse", color: 4, children: []category{
		leaf("health.plan", "Plano de saúde", "shield"),
		leaf("health.appointments", "Consultas", "stethoscope"),
		leaf("health.pharmacy", "Farmácia", "pill"),
		leaf("health.exams", "Exames", "hospital"),
		leaf("health.therapy", "Terapia", "heart"),
		leaf("health.gym", "Academia", "dumbbell"),
		leaf("health.dental", "Dentista", "smile"),
	}},
	{key: "leisure", name: "Lazer", icon: "gamepad-2", color: 5, children: []category{
		leaf("leisure.events", "Cinema, shows e eventos", "ticket"),
		leaf("leisure.streaming", "Streaming", "tv"),
		leaf("leisure.music", "Música", "music"),
		leaf("leisure.games", "Jogos", "gamepad-2"),
		leaf("leisure.books", "Livros", "book-open"),
		leaf("leisure.hobbies", "Hobbies", "palette"),
		leaf("leisure.apps", "Aplicativos e armazenamento", "smartphone"),
	}},
	{key: "travel", name: "Viagens", icon: "luggage", color: 6, children: []category{
		leaf("travel.flights", "Passagens", "plane"),
		leaf("travel.lodging", "Hospedagem", "hotel"),
		leaf("travel.activities", "Passeios", "map"),
	}},
	{key: "shopping", name: "Compras", icon: "shopping-bag", color: 7, children: []category{
		leaf("shopping.clothes", "Roupas e calçados", "shirt"),
		leaf("shopping.electronics", "Eletrônicos", "laptop"),
		leaf("shopping.gifts", "Presentes", "gift"),
		leaf("shopping.care", "Cuidados pessoais", "scissors"),
	}},
	{key: "education", name: "Educação", icon: "graduation-cap", color: 8, children: []category{
		leaf("education.courses", "Cursos", "school"),
		leaf("education.memberships", "Associações e comunidades", "briefcase"),
	}},
	{key: "pets", name: "Pets", icon: "paw-print", color: 1, children: []category{
		leaf("pets.supplies", "Ração, areia e petshop", "cat"),
		leaf("pets.vet", "Veterinário", "stethoscope"),
	}},
	{key: "giving", name: "Doações", icon: "hand-coins", color: 2},
}

// Income categories. Rendimentos groups the categories of investment income.
var incomeCategories = []category{
	{key: "income.salary", name: "Salário", icon: "banknote", color: 3},
	{key: "income.thirteenth", name: "13º salário", icon: "banknote", color: 3},
	{key: "income.vacation", name: "Férias", icon: "luggage", color: 3},
	{key: "income.bonus", name: "PLR e bônus", icon: "coins", color: 3},
	{key: "income.freelance", name: "Trabalhos extras", icon: "laptop", color: 4},
	{key: "income.meal", name: "Vale-refeição", icon: "utensils", color: 3},
	{key: "income.refunds", name: "Reembolsos", icon: "receipt", color: 5},
	{key: "income.cashback", name: "Cashback", icon: "percent", color: 5},
	{
		key:   "income.investments",
		name:  "Rendimentos",
		icon:  "trending-up",
		color: 6,
		children: []category{
			leaf("income.dividends", "Dividendos", "landmark"),
			leaf("income.fii", "Rendimentos de fundos imobiliários", "building-2"),
			leaf("income.jcp", "Juros sobre capital próprio", "hand-coins"),
			leaf("income.coupons", "Juros de renda fixa", "percent"),
		},
	},
}

// Children of the system accounts taxes and fees.
var taxCategories = []category{
	leaf("tax.inss", "INSS", "landmark"),
	leaf("tax.irrf", "IRRF", "landmark"),
	leaf("tax.iof", "IOF", "receipt"),
}

var feeCategories = []category{
	leaf("fee.bank", "Tarifas bancárias", "credit-card"),
	leaf("fee.card", "Anuidade de cartão", "credit-card"),
}

var payees = []string{
	"Tarsus Tecnologia Ltda",
	"QuintoAndar",
	"Condomínio Edifício Aurora",
	"Enel SP",
	"Sabesp",
	"Comgás",
	"Vivo Fibra",
	"Vivo Móvel",
	"Pão de Açúcar",
	"Carrefour",
	"Mercado Dia",
	"Hortifruti Natural da Terra",
	"Padaria Bella Paulista",
	"Empório Santa Luzia",
	"Açougue Boi Gordo",
	"iFood",
	"Rappi",
	"Outback Steakhouse",
	"Coco Bambu",
	"Starbucks",
	"Cafeteria Santo Grão",
	"Bar do Zé Pinheiros",
	"Madero",
	"Burger King",
	"Uber",
	"99",
	"Bilhete Único SPTrans",
	"Buser",
	"Tembici",
	"Smart Fit",
	"Drogasil",
	"Droga Raia",
	"Pague Menos",
	"Laboratório Fleury",
	"Dra. Helena Prado",
	"Clínica Mente Aberta",
	"Bradesco Saúde",
	"Netflix",
	"Spotify",
	"Amazon Prime",
	"Disney+",
	"HBO Max",
	"Cinemark",
	"Ingresso.com",
	"Sympla",
	"Steam",
	"Livraria da Vila",
	"Kindle",
	"Decathlon",
	"Zara",
	"Renner",
	"C&A",
	"Centauro",
	"Magazine Luiza",
	"Amazon",
	"Mercado Livre",
	"Apple",
	"KaBuM!",
	"Leroy Merlin",
	"Tok&Stok",
	"Boticário",
	"Barbearia & Salão Vila",
	"Cacau Show",
	"Duolingo",
	"Odonto Excellence",
	"Petz",
	"Cobasi",
	"Clínica Veterinária Patas",
	"Alura",
	"Associação Brasileira de Product Management",
	"Latam Airlines",
	"Booking.com",
	"Airbnb",
	"Decolar",
	"Azul Linhas Aéreas",
	"Receita Federal",
	"Itaú Unibanco",
	"Nubank",
	"XP Investimentos",
	"Rafael Mendes",
	"Mãe",
	"Instituto Pequeno Cidadão",
	"99Food",
	"Alelo",
}

// systemNames renames the system accounts, which the ledger creates in English, and gives each a color.
var systemNames = []struct {
	role, name string
	color      int
}{
	{
		"taxes",
		"Impostos",
		4,
	},
	{"fees", "Tarifas", 7},
	{"interest", "Juros", 4},
	{"discounts", "Descontos", 7},
	{
		"yield",
		"Rendimento de contas",
		6,
	},
	{"realized_gains", "Ganhos realizados", 6},
	{"realized_losses", "Perdas realizadas", 1},
	{"adjustments", "Ajustes", 8},
	{"opening_balances", "Saldos iniciais", 8},
	{
		"uncategorized_expense",
		"Despesa sem categoria",
		8,
	},
	{"uncategorized_income", "Receita sem categoria", 8},
	{"transfers_in_transit", "Transferências em trânsito", 8},
}
