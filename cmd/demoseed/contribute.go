package main

import (
	"math"
	"slices"
	"time"
)

const (
	// preTrackLabel describes the contributions of the years before the records began.
	preTrackLabel = "Aporte anterior ao registro"

	// brokerageFloor is the cash the owner keeps in the brokerage after reinvesting the month, in cents.
	brokerageFloor = 30000

	// minOrder is the smallest amount the owner sends to the broker, in cents.
	minOrder = 20000
)

// order is a purchase of about cents of a security.
type order struct {
	code  string
	cents int64
}

// contributions schedules, for every month since the first one, the deposit that the records lack, the purchases of the contribution and the reinvestment of the income and of what the month left.
func (s *seeder) contributions() {
	for k, m := range months(s.investStart(), s.today) {
		amount := monthlyContribution(k)
		payday := s.businessDay(m, 6)

		if m.Before(s.start) {
			s.investAt(payday, func() { s.depositBeforeRecords(payday, amount) })
		}

		buyDay := s.businessDay(m, 7)
		s.investAt(buyDay, func() { s.contribute(buyDay, amount*85/100) })

		sweepDay := s.businessDay(m, 9)
		s.investAt(sweepDay, func() {
			s.contribute(sweepDay, s.bal[s.id("xp.cash")]-brokerageFloor)
		})
	}
}

// monthlyContribution is the amount of the k-th month since the start of the investments, in cents. It grows with the salary and reaches the monthly transfer of the records.
func monthlyContribution(k int) int64 {
	return []int64{60000, 80000, 100000, 110000}[min(k/12, 3)]
}

// depositBeforeRecords brings the contribution of a month before the records began into the brokerage; its source is outside the books.
func (s *seeder) depositBeforeRecords(d time.Time, cents int64) {
	s.record(
		iso(d),
		preTrackLabel,
		nil,
		post(s.id("xp.cash"), cents),
		post(s.id("system.opening_balances"), -cents),
	)
}

// contribute buys on d, with cents of the brokerage cash, in the two groups furthest below their target share. It never sells.
func (s *seeder) contribute(d time.Time, cents int64) {
	cents = min(cents, s.bal[s.id("xp.cash")]*9/10)
	if cents < minOrder {
		return
	}

	for _, o := range s.orders(d, cents) {
		s.buyUnits(d, o)
	}
}

// orders splits cents among the two groups furthest below their target share, in proportion to the gap.
func (s *seeder) orders(d time.Time, cents int64) []order {
	values := s.groupValues(d)
	total := cents

	for _, v := range values {
		total += v
	}

	gaps := make([]int64, len(groups))
	for i, g := range groups {
		gaps[i] = int64(g.bp)*total/10000 - values[i]
	}

	ranked := make([]int, len(groups))
	for i := range ranked {
		ranked[i] = i
	}

	slices.SortStableFunc(ranked, func(a, b int) int { return int(gaps[b] - gaps[a]) })

	top := ranked[:2]

	var sum int64

	for _, i := range top {
		sum += max(gaps[i], 0)
	}

	var out []order

	for _, i := range top {
		if gaps[i] <= 0 {
			continue
		}

		if code := s.pickMember(groups[i], d); code != "" {
			out = append(out, order{code: code, cents: cents * gaps[i] / sum})
		}
	}

	return out
}

// groupValues is the value of each group on d, in cents.
func (s *seeder) groupValues(d time.Time) []int64 {
	out := make([]int64, len(groups))
	out[fixedIncomeGroup] = s.appliedValue(d)

	for i, g := range groups {
		for _, m := range g.members {
			sec := s.security(m.code)
			units := float64(s.hold[m.code]) / math.Pow(10, float64(sec.scale))
			out[i] += int64(units * s.priceOn(m.code, d) * 100)
		}
	}

	return out
}

// pickMember draws an instrument of the group that is listed on d; empty when none is.
func (s *seeder) pickMember(g group, d time.Time) string {
	var open []member

	total := 0

	for _, m := range g.members {
		if s.listed(m.code, d) {
			open = append(open, m)
			total += m.weight
		}
	}

	if total == 0 {
		return ""
	}

	n := s.inv.IntN(total)
	for _, m := range open {
		if n < m.weight {
			return m.code
		}

		n -= m.weight
	}

	return open[len(open)-1].code
}

// listed reports whether a security can be bought on d: it has a price by then and, for a bond, it has been issued.
func (s *seeder) listed(code string, d time.Time) bool {
	if issued, ok := s.security(code).terms["issued_on"].(string); ok && iso(d) < issued {
		return false
	}

	q := s.quotes[code]

	return len(q) == 0 || q[0].date <= iso(d)
}

// buyUnits buys whole units of o.code for about o.cents on d, a little off the closing price.
func (s *seeder) buyUnits(d time.Time, o order) {
	sec := s.security(o.code)
	price := s.priceOn(o.code, d) * (1 + (s.inv.Float64()*2-1)*.006)

	qty := int64(math.Floor(float64(o.cents) / 100 / price * math.Pow(10, float64(sec.scale))))
	if qty < 1 {
		return
	}

	s.trade(d, o.code, "buy", qty, price)
}

// earmarked are the purchases of the money set aside for a goal: the 13th salary feeds the emergency fund, the PLR the trip.
func (s *seeder) earmarked() {
	for _, e := range []struct {
		date string
		order
	}{
		{"2024-12-23", order{"TSELIC29", 150000}},
		{"2025-03-17", order{"CDBXP27", 600000}},
		{"2025-12-22", order{"TSELIC29", 150000}},
		{"2026-03-16", order{"CDBXP27", 600000}},
	} {
		d := day(e.date)
		s.investAt(d, func() { s.buyUnits(d, e.order) })
	}
}

// trims are the sales of a few percent of the largest position of a group, the way an investor who builds wealth takes some profit without leaving the market.
func (s *seeder) trims() {
	for _, t := range []struct {
		date    string
		group   int
		percent int64
	}{
		{"2025-09-18", 1, 15},
		{"2026-02-12", 1, 20},
		{"2026-06-10", 2, 10},
	} {
		d := day(t.date)

		s.investAt(d, func() {
			code := s.largestHolding(groups[t.group], d)
			if code == "" {
				return
			}

			qty := max(s.hold[code]*t.percent/100, 1)
			price := s.priceOn(code, d) * (1 + (s.inv.Float64()*2-1)*.006)
			s.trade(d, code, "sell", qty, price)
		})
	}
}

// largestHolding is the instrument of the group worth most on d; empty when the group holds none.
func (s *seeder) largestHolding(g group, d time.Time) string {
	best, code := 0.0, ""

	for _, m := range g.members {
		sec := s.security(m.code)
		units := float64(s.hold[m.code]) / math.Pow(10, float64(sec.scale))

		if v := units * s.priceOn(m.code, d); v > best {
			best, code = v, m.code
		}
	}

	return code
}
