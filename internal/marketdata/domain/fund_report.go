package domain

import "time"

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
