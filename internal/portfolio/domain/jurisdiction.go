package domain

import "time"

// UniversalIncomeTypes are the income types every jurisdiction accepts.
var UniversalIncomeTypes = []string{"coupon", "distribution", "dividend", "interest"}

// Jurisdiction derives tax data from the region of the owner.
type Jurisdiction interface {
	ID() string
	IncomeTypes() []string
	// TaxClass names the tax class of a security from its type, its subtype and its exchange.
	// A subtype the jurisdiction does not know takes the class of its type.
	TaxClass(instrumentType, subtype, exchange string) string
	// Treatment is the tax treatment of an income of a security of taxClass; "" when the type
	// has no treatment.
	Treatment(incomeType, taxClass string) string
	// Subtypes lists the subtypes the jurisdiction knows for an instrument type, sorted.
	Subtypes(instrumentType string) []string
	// TaxYear is the tax year that starts in year: from inclusive, to exclusive, in UTC.
	TaxYear(year int) (from, to time.Time)
	// Guarantee is the deposit guarantee of the jurisdiction; false when it has none.
	Guarantee() (Guarantee, bool)
	// UnitTax is the unit tax calendar of the funds of the jurisdiction; false when it has none.
	UnitTax() (UnitTax, bool)
}

// UnitTax is when a fund of the listed subtypes cancels units to withhold income tax: on the last
// business day of each month of Months in Calendar (A236 FC26).
type UnitTax struct {
	Calendar string
	Months   []time.Month
	Subtypes []string
}

// CalendarYear is the tax year of an owner without a jurisdiction.
func CalendarYear(year int) (from, to time.Time) {
	from = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	return from, from.AddDate(1, 0, 0)
}
