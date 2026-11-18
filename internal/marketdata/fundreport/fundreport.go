// Package fundreport reads the figures listed funds report to a regulator each month (FR1).
package fundreport

import (
	"context"
	"time"
)

// KeptPeriods is how many of the latest months a source keeps (FR6).
const KeptPeriods = 24

// Report is the figures of one fund for one month. A nil figure is a value the register leaves
// blank; it is never zero.
type Report struct {
	// Exchange is the ISO 10383 MIC and Code the trading code of the fund's unit.
	Exchange string
	Code     string
	// Shared is true when another fund of the same period gives Code; such a report reaches an
	// instrument only through the instrument's symbol for the source (FR15).
	Shared bool
	// Period is the first day of the month.
	Period     time.Time
	Identifier string
	Name       string
	Segment    string
	Delivered  *time.Time
	// NetAssets is an integer of minor units of Snapshot.Currency.
	NetAssets *int64
	Holders   *int64
	// Units, UnitBookValue, AdminFee, MonthYield and MonthAmortization are exact decimals.
	Units             *string
	UnitBookValue     *string
	AdminFee          *string
	MonthYield        *string
	MonthAmortization *string
}

// Snapshot holds the reports a fetch read.
type Snapshot struct {
	Currency string
	Reports  []Report
}

// Source reads the monthly reports of the funds of one register.
type Source interface {
	// ID identifies the source; it is a feed of ADR 025.
	ID() string
	// URL is the address of the register's page of the dataset.
	URL() string
	// Fetch returns the reports of every period of each file it read: the file of today's year
	// and the file of the year twelve months before today. A year whose twelve periods are all
	// in have, a file that did not change since the last fetch of the process and a file the
	// register does not hold are not read.
	Fetch(ctx context.Context, today time.Time, have []time.Time) (Snapshot, error)
}
