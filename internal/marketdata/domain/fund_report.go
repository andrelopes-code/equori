package domain

import "time"

// FundReportList is the report sets of one instrument and, for each enabled source whose set is
// empty, the funds that share the instrument's code (FR15).
type FundReportList struct {
	Items      []FundReport
	Candidates []FundReportCandidate
}

// FundReportCandidate is a fund whose code another fund of the same source also gives; the
// instrument's symbol for Source, set to Identifier, links it (FR15).
type FundReportCandidate struct {
	Source     string
	Identifier string
	Name       string
	Segment    string
}

// FundReport is the monthly reports of one listed fund from one source, newest first (FR1). A nil
// figure is a value the source leaves blank; it is never zero.
type FundReport struct {
	Source    string
	SourceURL string
	Exchange  string
	Code      string
	Currency  string
	// Identifier, Name and Segment are those of the newest period.
	Identifier string
	Name       string
	Segment    string
	Periods    []FundReportPeriod
}

type FundReportPeriod struct {
	Period    time.Time
	Delivered *time.Time
	NetAssets *int64
	Holders   *int64

	Units             *string
	UnitBookValue     *string
	AdminFee          *string
	MonthYield        *string
	MonthAmortization *string
}
