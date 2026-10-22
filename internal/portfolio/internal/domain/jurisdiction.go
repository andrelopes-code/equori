package domain

// UniversalIncomeTypes are the income types every jurisdiction accepts.
var UniversalIncomeTypes = []string{"coupon", "distribution", "dividend", "interest"}

// Jurisdiction derives tax data from the region of the owner.
type Jurisdiction interface {
	ID() string
	IncomeTypes() []string
	TaxClass(instrumentType, exchange string) string
	Treatment(incomeType string) string // "" when the type has no treatment
}
