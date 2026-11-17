package main

// group is a class of the portfolio: a target share in basis points and the instruments the persona buys for it. The contribution plan of the book states the same groups.
type group struct {
	name    string
	bp      int
	members []member
	split   bool // the plan states an ideal for each member, in proportion to its weight
}

// member is an instrument of a group; weight sets how often the persona picks it among the instruments listed on the date.
type member struct {
	code   string
	weight int
}

// fixedIncomeGroup is the group the contracts of applications count in.
const fixedIncomeGroup = 0

// groups are the classes of a moderate investor who builds wealth: growth assets dominate, fixed income steadies the rest.
var groups = []group{
	{
		name: "Renda fixa",
		bp:   3000,
		members: []member{
			{"B5P211", 2}, {"TSELIC29", 3}, {"TIPCA35", 3}, {"CDBXP27", 2},
		},
	},
	{
		name: "Ações Brasil",
		bp:   2800,
		members: []member{
			{"ITUB4", 4}, {"WEGE3", 4}, {"PETR4", 2}, {"BBAS3", 2}, {"ITSA4", 2},
			{"ABEV3", 1}, {"SBSP3", 2}, {"BPAC11", 1}, {"BOVA11", 3},
		},
		split: true,
	},
	{
		name:    "Exterior",
		bp:      2200,
		members: []member{{"IVVB11", 5}, {"NASD11", 3}, {"WRLD11", 2}},
		split:   true,
	},
	{
		name:    "Fundos imobiliários",
		bp:      1500,
		members: []member{{"HGLG11", 3}, {"KNRI11", 3}, {"MXRF11", 2}},
		split:   true,
	},
	{
		name:    "Ouro e cripto",
		bp:      500,
		members: []member{{"GOLD11", 2}, {"HASH11", 2}},
	},
}
