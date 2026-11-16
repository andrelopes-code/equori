package domain

import "time"

// InstitutionIndicators are the prudential indicators of the institution an identifier names
// (A237). A nil field is a value the source does not inform; it is never zero.
type InstitutionIndicators struct {
	Source    string
	SourceURL string
	// Period is the last day of the period the figures refer to.
	Period   time.Time
	Currency string
	// ConglomerateCode and ConglomerateName say whose figures these are.
	ConglomerateCode string
	ConglomerateName string
	// Basel, PrincipalCapital and FixedAsset are exact decimal fractions.
	Basel            *string
	PrincipalCapital *string
	FixedAsset       *string
	// Equity and NetIncome are integers of minor units of Currency.
	Equity    *int64
	NetIncome *int64
}
