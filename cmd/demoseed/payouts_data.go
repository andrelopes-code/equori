package main

import "time"

// payout is an income of a security. yield is the annual yield on the price of the day; each month of the payout pays its share of it.
type payout struct {
	code, kind, category string
	months               []time.Month
	day                  int
	yield                float64
}

var payouts = []payout{
	{"HGLG11", "dividend", "income.fii", allMonths, 14, .082},
	{"KNRI11", "dividend", "income.fii", allMonths, 14, .078},
	{"MXRF11", "dividend", "income.fii", allMonths, 14, .115},
	{"ITUB4", "dividend", "income.dividends", allMonths, 3, .012},
	{"ITUB4", "jcp", "income.jcp", []time.Month{2, 5, 8, 11}, 28, .04},
	{"PETR4", "dividend", "income.dividends", []time.Month{2, 5, 8, 11}, 21, .14},
	{"BBAS3", "dividend", "income.dividends", []time.Month{3, 6, 9, 12}, 20, .07},
	{"WEGE3", "jcp", "income.jcp", []time.Month{3, 9}, 15, .008},
	{"WEGE3", "dividend", "income.dividends", []time.Month{6, 12}, 15, .006},
	{"ITSA4", "jcp", "income.jcp", []time.Month{3, 6, 9, 12}, 20, .06},
	{"ABEV3", "jcp", "income.jcp", []time.Month{4, 10}, 15, .045},
	{"SBSP3", "dividend", "income.dividends", []time.Month{5, 11}, 20, .03},
	{"BPAC11", "dividend", "income.dividends", []time.Month{3, 6, 9, 12}, 15, .015},
}
