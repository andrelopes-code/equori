package domain

import "time"

// InstitutionIndicators are the prudential indicators of the institution an identifier names,
// by quarter, newest first (A237). A nil figure is a value the source does not inform; it is
// never zero.
type InstitutionIndicators struct {
	Source    string
	SourceURL string
	Currency  string
	// ConglomerateCode and ConglomerateName say whose figures these are, as of the newest period.
	ConglomerateCode string
	ConglomerateName string
	Limits           InstitutionLimits
	Periods          []InstitutionPeriod
}

// InstitutionPeriod is the figures of one quarter.
type InstitutionPeriod struct {
	// Period is the last day of the quarter.
	Period time.Time
	// Basel, PrincipalCapital and FixedAsset are exact decimal fractions.
	Basel            *string
	PrincipalCapital *string
	FixedAsset       *string
	// Equity and NetIncome are integers of minor units of the currency of the indicators.
	Equity    *int64
	NetIncome *int64
}

// InstitutionLimits are the regulatory floors of the source's jurisdiction (A237 L1).
type InstitutionLimits struct {
	Basel            InstitutionFloor
	PrincipalCapital InstitutionFloor
	Rule             string
}

// InstitutionFloor is a minimum and the minimum plus the conservation buffer, decimal fractions.
type InstitutionFloor struct {
	Minimum    string
	WithBuffer string
}
