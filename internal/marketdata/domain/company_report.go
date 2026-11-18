package domain

import "time"

// CompanyReport is the reports of one company from one source, newest first by period, then by
// months (CR6). Name, Consolidated and Plan are those of the newest period.
type CompanyReport struct {
	Source       string
	SourceURL    string
	Identifier   string
	Name         string
	Consolidated bool
	Plan         string
	Currency     string
	Periods      []CompanyReportPeriod
}

// CompanyReportPeriod is the accounts of one fiscal year or year to date. A nil account is a line
// the filing lacks; it is never zero. The accounts are minor units; the shares are counts.
type CompanyReportPeriod struct {
	Period    time.Time
	Months    int
	Delivered *time.Time

	TotalAssets        *int64
	CurrentAssets      *int64
	Cash               *int64
	ShortInvestments   *int64
	CurrentLiabilities *int64
	ShortDebt          *int64
	LongDebt           *int64
	Equity             *int64
	Revenue            *int64
	GrossProfit        *int64
	NetIncome          *int64
	OperatingCashFlow  *int64
	SharesIssued       *int64
	SharesTreasury     *int64
}
