package domain

import (
	"fmt"
	"math/big"
	"slices"
	"time"
)

// precision is the mantissa of the arithmetic of an accrual: about 77 decimal digits, far past
// the 12 decimals of a stored price (ADR 005). No float64 holds a rate or a price.
const precision = 256

const (
	businessDaysPerYear = 252
	daysPerYear         = 365
	newtonSteps         = 12
	priceDecimals       = 12
)

// IndexRate is the rate of an index for a period, an exact decimal fraction. An index that
// compounds by business day is dated on the business day it applies to; any other index on the first day of its month.
type IndexRate struct {
	Date time.Time
	Rate string
}

// IndexSummary is an enabled index with stored rates: its period (day or month) and the dates
// of its first and last rate.
type IndexSummary struct {
	ID          string
	Period      string
	First, Last time.Time
	// Expected is set when an enabled expectation source stored points for the index (ADR 026).
	Expected bool
}

// IndexExpectations is the latest survey of an index (ADR 026 E5).
type IndexExpectations struct {
	SurveyDate time.Time
	Points     []IndexRate
}

// DatedPrice is the price of one unit on a date, a decimal with 12 decimals.
type DatedPrice struct {
	Date  time.Time
	Value string
}

// Accrue computes the price of one unit of a fixed income security on each day from `from` to
// min(`to`, maturity), counting the growth from the issue date:
//
//   - an index that compounds by business day: the product of 1 + rate × percent over the
//     published business days after the issue; there is a price on each of those days and on the
//     issue date;
//   - another index: the product of 1 + rate over the months that begin on or after the issue
//     date and have ended, applied from the day after the month's last day (no pro rata);
//     there is a price on each weekday;
//   - no index: weekdays only;
//
// times the spread: the 252nd (bus252, counted in the business days of such an index) or 365th
// (act365, calendar days) root of 1 + spread, raised to the number of days. A day with no
// published rate has no price. quoteScale is the decimals of the quote currency of FaceValue.
func Accrue(
	t Terms,
	daily BusinessDayIndexes,
	quoteScale int,
	rates []IndexRate,
	from, to time.Time,
) ([]DatedPrice, error) {
	if err := t.Validate(daily); err != nil {
		return nil, err
	}

	byDay := daily.Has(t.IndexID)

	end := to
	if t.MaturesOn.Before(end) {
		end = t.MaturesOn
	}

	parsed, err := parseRates(rates)
	if err != nil {
		return nil, err
	}

	percent := ratio(int64(t.PercentOfIndexBP), 10000)
	dayRoot := spreadRoot(t)
	scale := new(big.Float).SetPrec(precision).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(quoteScale)), nil))
	face := new(big.Float).SetPrec(precision).SetInt64(t.FaceValue)
	face.Quo(face, scale)

	var out []DatedPrice
	state := accrualState{index: newFloat().SetInt64(1)}

	for _, d := range pricedDays(t, byDay, parsed, end) {
		if byDay {
			state.advanceDaily(t, parsed, percent, d)
		} else {
			state.advanceMonthly(t, parsed, d)
		}

		if d.Before(from) {
			continue
		}

		days := int(d.Sub(t.IssuedOn).Hours() / 24)
		if t.DayCount == DayCountBus252 {
			days = state.businessDays
		}

		price := newFloat().Mul(face, state.index)
		price.Mul(price, power(dayRoot, days))
		out = append(out, DatedPrice{Date: d, Value: price.Text('f', priceDecimals)})
	}

	return out, nil
}

// accrualState is the running index of an accrual: the product of the rates applied so far, the
// count of business days they cover and the position in the sorted rates.
type accrualState struct {
	index        *big.Float
	businessDays int
	next         int
}

// advanceDaily applies the rates of the business days up to d.
func (s *accrualState) advanceDaily(t Terms, parsed []parsedRate, percent *big.Float, d time.Time) {
	for s.next < len(parsed) && !parsed[s.next].date.After(d) {
		if parsed[s.next].date.After(t.IssuedOn) {
			s.index.Mul(s.index, newFloat().Add(newFloat().SetInt64(1), newFloat().Mul(parsed[s.next].rate, percent)))

			s.businessDays++
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

type parsedRate struct {
	date time.Time
	rate *big.Float
}

func parseRates(rates []IndexRate) ([]parsedRate, error) {
	out := make([]parsedRate, len(rates))
	for i, r := range rates {
		v, ok := newFloat().SetString(r.Rate)
		if !ok {
			return nil, fmt.Errorf("rate of %s: %q is not a decimal", r.Date.Format(time.DateOnly), r.Rate)
		}

		out[i] = parsedRate{date: r.Date, rate: v}
	}

	slices.SortStableFunc(out, func(a, b parsedRate) int { return a.date.Compare(b.date) })

	return out, nil
}

// pricedDays lists the days up to end that have a price, oldest first, from the issue date.
func pricedDays(t Terms, byDay bool, rates []parsedRate, end time.Time) []time.Time {
	var days []time.Time

	if t.IssuedOn.After(end) {
		return nil
	}

	if byDay {
		days = append(days, t.IssuedOn)
		for _, r := range rates {
			if r.date.After(t.IssuedOn) && !r.date.After(end) {
				days = append(days, r.date)
			}
		}

		return days
	}

	for d := t.IssuedOn; !d.After(end); d = d.AddDate(0, 0, 1) {
		if wd := d.Weekday(); wd != time.Saturday && wd != time.Sunday {
			days = append(days, d)
		}
	}

	return days
}

func monthEnd(first time.Time) time.Time { return first.AddDate(0, 1, -first.Day()) }

func newFloat() *big.Float { return new(big.Float).SetPrec(precision) }

func ratio(num, den int64) *big.Float {
	return newFloat().Quo(newFloat().SetInt64(num), newFloat().SetInt64(den))
}

// spreadRoot is the factor of one day of the spread: the root of 1 + spread of the year's days.
func spreadRoot(t Terms) *big.Float {
	one := newFloat().SetInt64(1)
	if t.SpreadBP == 0 {
		return one
	}

	n := daysPerYear
	if t.DayCount == DayCountBus252 {
		n = businessDaysPerYear
	}

	a := newFloat().Add(one, ratio(int64(t.SpreadBP), 10000))
	// Newton's method on x^n = a from 1 + spread/n, which lies above the root.
	x := newFloat().Add(one, ratio(int64(t.SpreadBP), int64(10000*n)))
	for range newtonSteps {
		xn1 := power(x, n-1)
		xn := newFloat().Mul(xn1, x)
		step := newFloat().Sub(xn, a)
		step.Quo(step, newFloat().Mul(newFloat().SetInt64(int64(n)), xn1))
		x.Sub(x, step)
	}

	return x
}

// power is x^n for n >= 0 by repeated squaring.
func power(x *big.Float, n int) *big.Float {
	result := newFloat().SetInt64(1)

	base := newFloat().Copy(x)
	for ; n > 0; n >>= 1 {
		if n&1 == 1 {
			result.Mul(result, base)
		}

		base.Mul(base, base)
	}

	return result
}
