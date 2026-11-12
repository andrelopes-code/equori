package main

import "time"

type payout struct {
	code, kind, category string
	months               []time.Month
	day                  int
	perShare             float64 // reais per unit
	steps                map[string]float64
}

var payouts = []payout{
	{
		code:     "HGLG11",
		kind:     "dividend",
		category: "income.fii",
		months:   allMonths,
		day:      14,
		perShare: 1.10,
		steps:    map[string]float64{"2025-08": 1.15},
	},
	{
		code:     "KNRI11",
		kind:     "dividend",
		category: "income.fii",
		months:   allMonths,
		day:      14,
		perShare: .98,
		steps:    map[string]float64{"2025-06": 1.00},
	},
	{
		code:     "MXRF11",
		kind:     "dividend",
		category: "income.fii",
		months:   allMonths,
		day:      14,
		perShare: .10,
		steps:    map[string]float64{"2025-04": .09},
	},
	{
		code:     "ITUB4",
		kind:     "dividend",
		category: "income.dividends",
		months:   allMonths,
		day:      3,
		perShare: .0155,
	},
	{
		code:     "ITUB4",
		kind:     "jcp",
		category: "income.jcp",
		months:   []time.Month{2, 5, 8, 11},
		day:      28,
		perShare: .25,
	},
	{
		code:     "PETR4",
		kind:     "dividend",
		category: "income.dividends",
		months:   []time.Month{2, 5, 8, 11},
		day:      21,
		perShare: .74,
	},
	{
		code:     "BBAS3",
		kind:     "dividend",
		category: "income.dividends",
		months:   []time.Month{3, 6, 9, 12},
		day:      20,
		perShare: .30,
	},
	{
		code:     "WEGE3",
		kind:     "jcp",
		category: "income.jcp",
		months:   []time.Month{3, 9},
		day:      15,
		perShare: .14,
	},
	{
		code:     "WEGE3",
		kind:     "dividend",
		category: "income.dividends",
		months:   []time.Month{6, 12},
		day:      15,
		perShare: .12,
	},
}
