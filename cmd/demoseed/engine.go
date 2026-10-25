package main

import (
	"slices"
	"time"
)

func iso(d time.Time) string { return d.Format(time.DateOnly) }

func ym(d time.Time) string { return d.Format("2006-01") }

// months lists the first day of every month from start through the month of today.
func months(start, today time.Time) []time.Time {
	var out []time.Time
	for m := start; !m.After(today); m = m.AddDate(0, 1, 0) {
		out = append(out, m)
	}
	return out
}

// onDay returns the given day of the month, clamped to the last day.
func onDay(month time.Time, day int) time.Time {
	last := month.AddDate(0, 1, -1).Day()
	return time.Date(month.Year(), month.Month(), min(day, last), 0, 0, 0, 0, time.UTC)
}

// businessDay returns the nth weekday of the month. Holidays are ignored.
func businessDay(month time.Time, n int) time.Time {
	d := month
	for count := 0; ; d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Saturday && d.Weekday() != time.Sunday {
			count++
			if count == n {
				return d
			}
		}
	}
}

// weekdaysOf lists the days of the month that fall on wd.
func weekdaysOf(month time.Time, wd time.Weekday) []time.Time {
	var out []time.Time
	for d := month; d.Month() == month.Month(); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == wd {
			out = append(out, d)
		}
	}
	return out
}

// at schedules run on d; a date outside the history is dropped.
func (s *seeder) at(d time.Time, run func()) {
	if d.Before(s.start) || d.After(s.today) {
		return
	}
	s.events = append(s.events, event{date: d, run: run})
}

func (s *seeder) runEvents() {
	slices.SortStableFunc(s.events, func(a, b event) int { return a.date.Compare(b.date) })
	for _, e := range s.events {
		if s.err != nil {
			return
		}
		e.run()
	}
}

// step returns the value of a price that changes on given months: steps maps "YYYY-MM" to the price from that month.
func step(month time.Time, base int64, steps map[string]int64) int64 {
	out := base
	best := ""
	for from, v := range steps {
		if from <= ym(month) && from > best {
			out, best = v, from
		}
	}
	return out
}

// jitter scales cents by a random factor within ±pct percent and rounds to whole cents.
func (s *seeder) jitter(cents int64, pct float64) int64 {
	return int64(float64(cents) * (1 + (s.rng.Float64()*2-1)*pct/100))
}

// between returns a random amount in [lo, hi] cents; skew above 1 favors the low end.
func (s *seeder) between(lo, hi int64, skew float64) int64 {
	u := s.rng.Float64()
	for i := 1.0; i < skew; i++ {
		u *= s.rng.Float64()
	}
	return lo + int64(u*float64(hi-lo))
}

// pick returns a key of weights chosen by weight, in the order of keys.
func (s *seeder) pick(keys []string, weights []int) string {
	total := 0
	for _, w := range weights {
		total += w
	}
	n := s.rng.IntN(total)
	for i, w := range weights {
		if n < w {
			return keys[i]
		}
		n -= w
	}
	return keys[len(keys)-1]
}

// funders names the account that refills an account that cannot pay.
var funders = map[string]string{
	"nubank.checking": "itau.checking",
	"itau.checking":   "itau.savings",
	"wallet":          "itau.checking",
	"xp.cash":         "itau.checking",
	"mb.cash":         "nubank.checking",
}

// ensure moves money into key so that it can pay need cents on date.
func (s *seeder) ensure(date time.Time, key string, need int64) {
	short := need - s.bal[s.id(key)]
	if short <= 0 {
		return
	}
	from, ok := funders[key]
	if !ok {
		s.fail("%s holds %d cents and cannot pay %d on %s", key, s.bal[s.id(key)], need, iso(date))
		return
	}
	top := (short + 60000) / 10000 * 10000
	desc := map[string]string{
		"nubank.checking": "Pix para Nubank",
		"itau.checking":   "Resgate da poupança Itaú",
		"wallet":          "Saque caixa eletrônico",
		"xp.cash":         "TED para XP Investimentos",
		"mb.cash":         "Pix para Mercado Bitcoin",
	}[key]
	if key == "wallet" {
		top = (short + 15000) / 5000 * 5000
	}
	s.ensure(date, from, top)
	s.record(iso(date), desc, nil, post(s.id(key), top), post(s.id(from), -top))
}
