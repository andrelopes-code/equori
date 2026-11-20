package main

// corporateAction is a split or a bonus of a security on its first day without the right. Each unit held becomes
// to/from units, rounded down.
type corporateAction struct {
	code, date, kind string
	from, to         int64
}

// actions are the splits and bonuses of the securities since the first month of the investments, as the split events
// of the Yahoo Finance chart list them. An event with a ratio that is no whole number of units (SBSP3 on 2025-12-26 and
// 2026-03-20) adjusts for a cash payment, not for a change of units, and is left out.
var actions = []corporateAction{
	{"MXRF11", "2017-05-17", "split", 1, 10},
	{"HGLG11", "2018-04-18", "split", 1, 10},
	{"WEGE3", "2018-04-25", "bonus", 10, 13},
	{"ITSA4", "2018-06-01", "bonus", 10, 11},
	{"ITUB4", "2018-11-21", "bonus", 2, 3},
	{"WEGE3", "2021-04-28", "split", 1, 2},
	{"BPAC11", "2021-07-01", "split", 1, 4},
	{"ITSA4", "2021-12-21", "bonus", 20, 21},
	{"ITSA4", "2022-11-11", "bonus", 10, 11},
	{"ITSA4", "2023-11-28", "bonus", 20, 21},
	{"BBAS3", "2024-04-16", "split", 1, 2},
	{"ITSA4", "2024-12-03", "bonus", 20, 21},
	{"ITUB4", "2025-03-18", "bonus", 10, 11},
	{"ITSA4", "2025-12-19", "bonus", 50, 51},
	{"ITUB4", "2025-12-26", "bonus", 100, 103},
	{"SBSP3", "2026-04-29", "split", 1, 5},
}
