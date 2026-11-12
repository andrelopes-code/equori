package domain

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// QuoteDates are the dates a price change is read against (IQ4 of the instrument quotes design).
type QuoteDates struct {
	Week, Month, Quarter, Year, YearToDate time.Time
}

// QuoteReferences returns the reference dates of the change columns of the catalog, counted back
// from anchor, the date of the last price. A month shift that lands past the end of the target
// month clamps to its last day.
func QuoteReferences(anchor time.Time) QuoteDates {
	return QuoteDates{
		Week:       anchor.AddDate(0, 0, -7),
		Month:      monthsBack(anchor, 1),
		Quarter:    monthsBack(anchor, 3),
		Year:       monthsBack(anchor, 12),
		YearToDate: time.Date(anchor.Year()-1, time.December, 31, 0, 0, 0, 0, anchor.Location()),
	}
}

// QuotePoint is the chosen price of one date.
type QuotePoint struct {
	Date  time.Time
	Value money.Rate
}

// QuoteReferencesOf holds the price of each reference date; nil when no price qualifies.
type QuoteReferencesOf struct {
	Week, Month, Quarter, Year, YearToDate *QuotePoint
}

// InstrumentQuote is the last price of an instrument and the prices its changes start from.
type InstrumentQuote struct {
	Instrument money.Currency
	Quote      money.Currency
	Last       *QuotePoint
	References QuoteReferencesOf
}

// Inside returns ref when it lies before last, and nil otherwise: a price that does not predate
// the last one gives no change (IQ5).
func Inside(last, ref *QuotePoint) *QuotePoint {
	if last == nil || ref == nil || !ref.Date.Before(last.Date) {
		return nil
	}

	return ref
}

func monthsBack(day time.Time, months int) time.Time {
	first := time.Date(day.Year(), day.Month()-time.Month(months), 1, 0, 0, 0, 0, day.Location())
	end := first.AddDate(0, 1, -1).Day()

	return time.Date(first.Year(), first.Month(), min(day.Day(), end), 0, 0, 0, 0, day.Location())
}
