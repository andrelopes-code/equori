package domain

import (
	"time"
)

// Coupon is what one unit of a fixed income security pays on a payment date (A236 FC8).
type Coupon struct {
	Date           time.Time // adjusted to the next business day (FC7)
	PaysOn         time.Time // the date of the terms
	Interest       string    // per unit, 12 decimals; empty when RateMissing
	Principal      string    // face × I(p) per unit, 12 decimals; empty when RateMissing
	AmortizationBP int
	// AmortizeOneOf amortizes one part in this many of the units held, zero when AmortizationBP
	// states the share: the monthly payments of an RendA+ or an Educa+ (coverage row T-06).
	AmortizeOneOf int
	PaysInterest  bool
	RateMissing   bool
}

// Coupons is the coupon of each payment of t, in the order of t.Payments. It runs the state of
// Accrue, so the interest of a date is the price of that date less the principal. A date whose
// rate is not published has no figures; a payment that does not pay interest has interest zero.
func Coupons(
	t Terms,
	daily BusinessDayIndexes,
	quoteScale int,
	rates []IndexRate,
	isBusinessDay BusinessDay,
) ([]Coupon, error) {
	if err := checkAccrual(t, daily, isBusinessDay); err != nil {
		return nil, err
	}

	byDay := daily.Has(t.IndexID)

	parsed, err := parseRates(rates)
	if err != nil {
		return nil, err
	}

	percent := ratio(int64(t.PercentOfIndexBP), 10000)
	dayRoot := spreadRoot(t)
	face := faceUnits(t.FaceValue, quoteScale)
	state := newAccrualState(t, isBusinessDay)
	figures := map[time.Time][2]string{}

	for _, d := range pricedDays(t, byDay, parsed, t.MaturesOn, isBusinessDay) {
		state.advance(t, byDay, parsed, percent, d)

		interest, principal := state.coupon(t, face, dayRoot, d)
		figures[d] = [2]string{interest, principal}
	}

	out := make([]Coupon, len(t.Payments))
	for i, p := range t.Payments {
		d := adjustedDate(t, p.PaysOn, isBusinessDay)
		out[i] = newCoupon(p, d, figures[d], publishedBy(t, byDay, parsed, d))
	}

	return out, nil
}

// newCoupon is the coupon of p on its adjusted date d; figures is empty when d is not a priced day.
func newCoupon(p Payment, d time.Time, figures [2]string, published bool) Coupon {
	c := Coupon{
		Date:           d,
		PaysOn:         p.PaysOn,
		AmortizationBP: p.AmortizationBP,
		PaysInterest:   p.PaysInterest,
	}

	if !published || figures[1] == "" {
		c.RateMissing = true

		return c
	}

	c.Interest, c.Principal = figures[0], figures[1]
	if !p.PaysInterest {
		c.Interest = newFloat().Text('f', priceDecimals)
	}

	return c
}

// publishedBy reports whether the rates that d needs are published: a month index needs the
// latest month that ended on or before d; a daily index is priced only on days with a rate; a
// contract without an index needs none.
func publishedBy(t Terms, byDay bool, parsed []parsedRate, d time.Time) bool {
	if t.IndexID == "" || byDay {
		return true
	}

	needed := monthEnd(time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, d.Location()))
	if needed.After(d) {
		needed = needed.AddDate(0, -1, 0)
	}

	first := time.Date(needed.Year(), needed.Month(), 1, 0, 0, 0, 0, needed.Location())
	if first.Before(t.IssuedOn) {
		return true
	}

	return len(parsed) > 0 && !parsed[len(parsed)-1].date.Before(first)
}
