package domain

import (
	"math"
	"time"
)

// IndexedResult is what an account would have earned at an index over (start, until] with the
// opening balance and the flows of the portfolio (AT11): each day first grows the balance by
// growth(day), then takes the flows of the day, so a flow earns from the next day as in the
// time-weighted return (amendment A208). The result is the closing balance less the opening and
// the flows, in minor units rounded half to even.
func IndexedResult(
	start, until time.Time,
	opening int64,
	flows []CashFlow,
	growth func(day time.Time) float64,
) int64 {
	byDay := map[time.Time]int64{}
	in := int64(0)

	for _, f := range flows {
		if within(f.Date, start, until) {
			byDay[f.Date] += f.Amount
			in += f.Amount
		}
	}

	balance := float64(opening)
	for d := start.AddDate(0, 0, 1); !d.After(until); d = d.AddDate(0, 0, 1) {
		balance = balance*growth(d) + float64(byDay[d])
	}

	return int64(math.RoundToEven(balance)) - opening - in
}
