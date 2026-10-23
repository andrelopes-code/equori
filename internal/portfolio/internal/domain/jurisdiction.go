package domain

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
}
