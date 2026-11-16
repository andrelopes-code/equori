package domain

import (
	"math/big"
	"slices"
	"time"
)

// accrualState is the running state of an accrual: index is I, the product of the rates of a
// monthly index since the issue; period is the product of the rates of a daily index since the
// start of the period; periodDays counts the business days of the period and periodStart is its
// first day, the issue date and then each adjusted interest date. next is the position in the
// sorted rates. restarts are the adjusted interest dates and restart the position in them.
type accrualState struct {
	index       *big.Float
	period      *big.Float
	periodDays  int
	periodStart time.Time
	next        int
	restarts    []time.Time
	restart     int
}

func newAccrualState(t Terms, isBusinessDay BusinessDay) *accrualState {
	return &accrualState{
		index:       newFloat().SetInt64(1),
		period:      newFloat().SetInt64(1),
		periodStart: t.IssuedOn,
		restarts:    adjustedInterestDates(t, isBusinessDay),
	}
}

// advance starts a new period when an interest date has passed, applies the rates up to d and
// counts d when it is a priced day of an index that does not compound by business day.
func (s *accrualState) advance(
	t Terms,
	byDay bool,
	parsed []parsedRate,
	percent *big.Float,
	d time.Time,
) {
	s.startPeriod(d)

	if byDay {
		s.advanceDaily(t, parsed, percent, d)

		return
	}

	s.advanceMonthly(t, parsed, d)

	if d.After(t.IssuedOn) {
		s.periodDays++
	}
}

// price is face × I × J on d: J is the product of the period's rates times the spread root
// raised to the days of the period.
func (s *accrualState) price(t Terms, face, dayRoot *big.Float, d time.Time) string {
	days := int(d.Sub(s.periodStart).Hours() / 24)
	if t.DayCount == DayCountBus252 {
		days = s.periodDays
	}

	price := newFloat().Mul(face, s.index)
	price.Mul(price, s.period)
	price.Mul(price, power(dayRoot, days))

	return price.Text('f', priceDecimals)
}

// startPeriod restarts the daily product and the day count on the first priced day after an
// adjusted interest date.
func (s *accrualState) startPeriod(d time.Time) {
	for s.restart < len(s.restarts) && s.restarts[s.restart].Before(d) {
		s.period = newFloat().SetInt64(1)
		s.periodDays = 0
		s.periodStart = s.restarts[s.restart]
		s.restart++
	}
}

// advanceDaily applies the rates of the business days up to d.
func (s *accrualState) advanceDaily(t Terms, parsed []parsedRate, percent *big.Float, d time.Time) {
	for s.next < len(parsed) && !parsed[s.next].date.After(d) {
		if parsed[s.next].date.After(t.IssuedOn) {
			s.period.Mul(
				s.period,
				newFloat().Add(newFloat().SetInt64(1), newFloat().Mul(parsed[s.next].rate, percent)),
			)

			s.periodDays++
		}

		s.next++
	}
}

// advanceMonthly applies the rates of the months that ended before the day after d.
func (s *accrualState) advanceMonthly(t Terms, parsed []parsedRate, d time.Time) {
	for s.next < len(parsed) && monthEnd(parsed[s.next].date).Before(d.AddDate(0, 0, 1)) {
		if !parsed[s.next].date.Before(t.IssuedOn) {
			s.index.Mul(s.index, newFloat().Add(newFloat().SetInt64(1), parsed[s.next].rate))
		}

		s.next++
	}
}

// adjustedInterestDates are the dates of the interest payments moved to the next business day:
// isBusinessDay when given, else the next weekday (A236 FC7). A date past maturity has no price.
func adjustedInterestDates(t Terms, isBusinessDay BusinessDay) []time.Time {
	var out []time.Time

	for _, p := range t.Payments {
		if !p.PaysInterest {
			continue
		}

		d := p.PaysOn
		for !d.After(t.MaturesOn) && !isPriceable(d, isBusinessDay) {
			d = d.AddDate(0, 0, 1)
		}

		out = append(out, d)
	}

	slices.SortFunc(out, func(a, b time.Time) int { return a.Compare(b) })

	return out
}
