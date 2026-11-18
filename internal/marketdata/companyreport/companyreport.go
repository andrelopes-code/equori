// Package companyreport reads the statements listed companies file with a regulator (CR1).
package companyreport

import (
	"context"
	"time"
)

// Report is the accounts of one company for one period. A nil account is a line the filing lacks
// or the chart of accounts does not hold; it is never zero.
type Report struct {
	Identifier string
	// Period is the last day of the fiscal year or quarter; Months the span from the start of the
	// fiscal year: 12, or 3, 6 or 9 for the year to date of a quarter.
	Period       time.Time
	Months       int
	Name         string
	Consolidated bool
	// Plan is "standard" or "other" (CR5).
	Plan      string
	Delivered *time.Time
	// The accounts are integers of minor units of Snapshot.Currency; the shares are counts.
	TotalAssets, CurrentAssets, Cash, ShortInvestments, CurrentLiabilities *int64
	ShortDebt, LongDebt, Equity, Revenue, GrossProfit, NetIncome           *int64
	OperatingCashFlow, SharesIssued, SharesTreasury                        *int64
}

// Listing ties a trading code of an exchange to a company (CR4).
type Listing struct {
	Exchange, Code, Identifier, Name string
}

// File is the reports of one file the fetch read; Name is its key in storage, such as "dfp_2025".
type File struct {
	Name    string
	Reports []Report
}

// Snapshot holds what a fetch read.
type Snapshot struct {
	Currency string
	// Window names every file of the window of the fetch, read or not; stored rows of a file
	// outside it are deleted.
	Window []string
	Files  []File
	// Listings is nil when the listing file was not read.
	Listings []Listing
}

// Source reads the statements of the companies of one register.
type Source interface {
	ID() string
	URL() string
	Fetch(ctx context.Context, today time.Time) (Snapshot, error)
}
