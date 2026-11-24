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
	// Financial is true for a company of the financial sector.
	Financial bool
	Currency  string
	Periods   []CompanyReportPeriod
	// SharesPerUnit is the number of shares of the security the report was asked for, 1 for a
	// share; nil when unknown.
	SharesPerUnit *int
	// ShareCounts is the capital in units of shares a second filing states, by year.
	ShareCounts map[int]int64
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

	NetIncomeParent *int64
	EquityMinority  *int64
	// ClassesDiffer is true when a share of one class does not stand for a share of another.
	ClassesDiffer bool
	// CapitalRaised is true when the share capital grew with new resources in the period, false when
	// it grew only with reserves, nil when it did not grow or the filing does not say.
	CapitalRaised *bool
}
