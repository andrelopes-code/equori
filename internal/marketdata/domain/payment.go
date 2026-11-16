package domain

import (
	"fmt"
	"time"
)

const maxAmortizationBP = 10000

// Payment is a date on which a fixed income security pays interest, returns principal or both
// (A236 FC6). PaysOn is the date of the terms; the payment falls on the next business day.
type Payment struct {
	PaysOn         time.Time
	AmortizationBP int // basis points of the principal at issue; 0 for interest only
	PaysInterest   bool
}

// Schedule expands an interest period into payments up to maturity (A236 FC6): first, then one
// date each everyMonths months, the day of month clamped to the month's last day, each before
// maturesOn, then maturesOn.
func Schedule(first, maturesOn time.Time, everyMonths int) ([]Payment, error) {
	switch {
	case everyMonths != 1 && everyMonths != 3 && everyMonths != 6 && everyMonths != 12:
		return nil, invalid("interest_every_months", "must be 1, 3, 6 or 12")
	case first.After(maturesOn):
		return nil, invalid("first_payment_on", "must be on or before matures_on")
	}

	var out []Payment

	for k := 0; ; k++ {
		d := addMonthsClamped(first, k*everyMonths)
		if !d.Before(maturesOn) {
			break
		}

		out = append(out, Payment{PaysOn: d, PaysInterest: true})
	}

	return append(out, Payment{PaysOn: maturesOn, PaysInterest: true}), nil
}

// validatePayments checks the rows of t.Payments, sorted by PaysOn.
func (t Terms) validatePayments() error {
	seen := map[time.Time]bool{}
	total := 0

	for i, p := range t.Payments {
		field := fmt.Sprintf("payments[%d]", i)

		switch {
		case !p.PaysOn.After(t.IssuedOn) || p.PaysOn.After(t.MaturesOn):
			return invalid(field, "must be after issued_on and on or before matures_on")
		case seen[p.PaysOn]:
			return invalid(field, "repeats a date")
		case p.AmortizationBP < 0 || p.AmortizationBP > maxAmortizationBP:
			return invalid(field, "amortization_bp must be 0 to 10000")
		case !p.PaysInterest && p.AmortizationBP == 0:
			return invalid(field, "pays interest or returns principal")
		}

		seen[p.PaysOn] = true
		total += p.AmortizationBP
	}

	if total > maxAmortizationBP {
		return invalid("payments", "amortizations sum to more than 10000 bp")
	}

	return nil
}

// addMonthsClamped is d plus n months with the day of month kept, or the month's last day when
// the month is shorter.
func addMonthsClamped(d time.Time, n int) time.Time {
	first := time.Date(d.Year(), d.Month()+time.Month(n), 1, 0, 0, 0, 0, d.Location())
	last := first.AddDate(0, 1, -1).Day()

	return time.Date(first.Year(), first.Month(), min(d.Day(), last), 0, 0, 0, 0, d.Location())
}
