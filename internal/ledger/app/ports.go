// Package app implements the ledger use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrNonZeroBalance     = errors.New("account balance is not zero")
	ErrPostingsAfterClose = errors.New("account has postings after the closing date")
	ErrSystemAccount      = errors.New("system accounts cannot be closed, reopened or merged")
	ErrSettingsLocked     = errors.New("settings cannot change after the first transaction")
	ErrStatementNotClosed = errors.New("statement has not closed yet")
	ErrStatementFinanced  = errors.New("statement is already financed")
	ErrDisputeOpen        = errors.New("the transaction already has an open dispute")
	ErrDisputeResolved    = errors.New("the dispute is already resolved")
	ErrInstitutionInUse   = errors.New("an open account uses the institution")
	ErrNotInlineable      = errors.New("only a PDF or an image is shown inline")
	ErrDifferenceRemains  = errors.New("the settled balance still differs from the assertion")
	ErrUnknownInstrument  = errors.New("unknown instrument")
	ErrMixedInstruments   = errors.New(
		"the account and its sub-accounts hold more than one instrument",
	)
	ErrPriceMissing = errors.New("price missing")
	// ErrLaterSaleExists: the change would alter the cost of a recorded sale (P8 A69).
	ErrLaterSaleExists = errors.New(
		"a later sale of the security exists; a day with a purchase after a sale is " +
			"recorded as a brokerage note",
	)
	// ErrInvestmentTransaction: trades and income are corrected through their order (A227 IC13).
	ErrInvestmentTransaction = errors.New(
		"a trade or income transaction is corrected through its own order, not through its postings",
	)
)

// Clock is satisfied by platform/clock.Clock.
type Clock interface {
	Now() time.Time
	Today(ctx context.Context) time.Time
}

// Instruments reads the instruments of Market data (P8 amendment A63).
type Instruments interface {
	Instrument(ctx context.Context, code money.Currency) (Instrument, error)
	ResolveCode(ctx context.Context, code money.Currency) (money.Currency, error)
	SettlementDate(ctx context.Context, code money.Currency, date time.Time) (time.Time, error)
}

// Instrument is what Ledger needs of a Market data instrument; QuoteCurrency is empty
// for a currency.
type Instrument struct {
	Code          money.Currency
	Scale         int
	QuoteCurrency money.Currency
	Type          string
}

// Prices converts amounts with stored prices (Market data, P8 amendment A61); it returns
// an error wrapping ErrPriceMissing when no path exists.
type Prices interface {
	Convert(
		ctx context.Context,
		q money.Money,
		to money.Currency,
		date time.Time,
	) (Conversion, error)
}

// ExternalFlow is money that entered (positive) or left (negative) an account tree on a date,
// in the balancing currency of its transaction.
type ExternalFlow struct {
	Date  time.Time
	Value money.Money
}

type Conversion struct {
	Value  money.Money
	Prices []Price
	// Parts is the value of each instrument held, filled by ValuedBalance in instrument order.
	Parts []ValuedPart
}

// ValuedPart is a quantity of one instrument held in a tree of accounts and its value.
type ValuedPart struct {
	Instrument money.Currency
	Quantity   money.Money
	Value      money.Money
}

type Price struct {
	Instrument, Quote money.Currency
	Date              time.Time
	Value             money.Rate
	Source            string
}

// Calendar shifts due dates to business days (marketdata, P2 amendment A2).
type Calendar interface {
	Adjust(ctx context.Context, calendar string, d time.Time, adjustment string) (time.Time, error)
	DefaultCalendar(region string) string
}

// Profiles gives the language and region of a book (identity).
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// RegionDefaults gives the values a record takes from the region of its owner, or from the
// currency of its account.
type RegionDefaults interface {
	ForeignChargeBP(region string) int
	WithholdingBP(region, incomeType string) int
	ReserveYieldPercent(currency money.Currency) int64
	SeparatesDayTrades(region string) bool
	CostMethod(region, instrumentType string) string
}

// Repository stores the ledger tables; postgres/ implements it.
// Repository returns ErrNotFound for missing rows. Publish is valid only inside InTx.
type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	Publish(ctx context.Context, e outbox.Event) error

	accountStore
	transactionStore
	cardStore
	reconciliationStore
	importStore
	reportStore
}
