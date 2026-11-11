package app

import (
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// window is the days a comparison covers: the return of [returnFrom, until] and the whole months
// inside [since, until] (R16, R18), and the rates dated in [ratesFrom, ratesTo] on days the tree
// held money (R14, R20).
type window struct {
	since, until       time.Time
	returnFrom         time.Time
	ratesFrom, ratesTo time.Time
	restarted          bool
}

// comparedWindow is the window of the index and inflation comparisons (R14, R18, R20): from the
// first day the tree held money to the end of the period. A tree whose yield is recorded is
// compared over (A, B], A being the first yield credit in [from − 1, to], moved by a flow between
// two distant credits, and B the last credit dated on or before the day after the last stored rate
// of the index (R20); its rates are those dated in [A, B). ok is false, with the reason on the
// report, when the tree held no money, recorded no yield, one credit only, or no credit after A
// within the rates.
func (p period) comparedWindow(start int64, ends []domain.Subperiod, dates []time.Time, rates []IndexRate) (window, bool) {
	since, ok := firstHeldDay(p.from, start, ends, dates)
	if !ok {
		p.unavailable(ReasonNothingHeld)

		return window{}, false
	}

	w := window{since: since, until: p.to, returnFrom: p.from, ratesFrom: since, ratesTo: p.to}
	if !p.recorded {
		return w, true
	}

	credits := p.creditDates()
	if len(credits) == 0 {
		p.unavailable(ReasonNoYieldRecorded)

		return window{}, false
	}

	if a, _ := domain.ComparisonStart(credits, p.flowDates()); a.Equal(credits[len(credits)-1]) {
		p.unavailable(ReasonSingleCredit)

		return window{}, false
	}

	credits = withinRates(credits, rates)
	if len(credits) == 0 {
		p.unavailable(ReasonNoRateInWindow)

		return window{}, false
	}

	a, restarted := domain.ComparisonStart(credits, p.flowDates())

	b := credits[len(credits)-1]
	if !b.After(a) {
		p.unavailable(ReasonNoRateInWindow)

		return window{}, false
	}

	w.returnFrom = a.AddDate(0, 0, 1)
	w.until = b
	w.ratesFrom = a
	w.ratesTo = b.AddDate(0, 0, -1)
	w.restarted = restarted

	if w.returnFrom.After(since) {
		w.since = w.returnFrom
	}

	return w, true
}

// heldDays reports whether the tree held money on a day: a day belongs to the subperiod that ends
// on or after it, and that subperiod held money when its start value was not 0 (R14). With
// endOfDay, the day counts when the tree holds money at the end of it, the rate of a day being
// earned by the balance of its end (R20); the day before from is then the day of the opening value.
func heldDays(from time.Time, start int64, ends []domain.Subperiod, dates []time.Time, endOfDay bool) func(time.Time) bool {
	return func(day time.Time) bool {
		if endOfDay && day.Equal(from.AddDate(0, 0, -1)) {
			return start != 0
		}

		if day.Before(from) {
			return false
		}

		value := start
		for i, end := range dates {
			if day.After(end) {
				value = ends[i].Value

				continue
			}

			if endOfDay && day.Equal(end) {
				return ends[i].Value != 0
			}

			return value != 0
		}

		return false
	}
}

// heldMonth reports whether the tree held money on every day of the month that starts on first.
func heldMonth(first time.Time, held func(time.Time) bool) bool {
	for day := first; day.Before(first.AddDate(0, 1, 0)); day = day.AddDate(0, 0, 1) {
		if !held(day) {
			return false
		}
	}

	return true
}

// firstHeldDay is the first day of the period the tree held money: from when it held money at the
// end of from − 1, else the day after the first subperiod that ends with money. ok is false when
// no subperiod before the last one ends with money.
func firstHeldDay(from time.Time, start int64, ends []domain.Subperiod, dates []time.Time) (time.Time, bool) {
	if start != 0 {
		return from, true
	}

	for i := 0; i < len(ends)-1; i++ {
		if ends[i].Value != 0 {
			return dates[i].AddDate(0, 0, 1), true
		}
	}

	return time.Time{}, false
}
