// Package app implements the ledger use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
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
	// ErrContractInvalid wraps the field errors of a fixed income contract (A236 FC14).
	ErrContractInvalid = errors.New("invalid contract")
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
	// Subtype is the subtype of a security, empty when it has none. It can change, so it is read
	// at each call and never cached.
	Subtype(ctx context.Context, code money.Currency) (string, error)
}

// Instrument is what Ledger needs of a Market data instrument; QuoteCurrency is empty
// for a currency.
type Instrument struct {
	Code          money.Currency
	Scale         int
	QuoteCurrency money.Currency
	Type          string
	BooksID       int64 // 0: a public security
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
	// WarmCurrent asks for the current quotes of codes and waits a bounded time (A248 CQ18).
	WarmCurrent(ctx context.Context, codes []money.Currency)
	// ConvertCurrent values q in to now; it returns the errors of Convert (A248 CQ16).
	ConvertCurrent(ctx context.Context, q money.Money, to money.Currency) (Conversion, error)
}

// Contracts defines and discards the fixed income contracts of a book (A236 FC14).
type Contracts interface {
	// Check validates c for the application and returns it with the defaults of FC12 applied. A
	// field error wraps ErrContractInvalid.
	Check(
		ctx context.Context,
		booksID int64,
		c Contract,
		applicationID uuid.UUID,
	) (Contract, error)
	Define(ctx context.Context, booksID int64, c Contract) error
	// Discard deletes the instrument when no account uses it.
	Discard(ctx context.Context, booksID int64, code money.Currency) error
	// Price is the chosen price of the latest date up to date; false when there is none.
	Price(ctx context.Context, code, quote money.Currency, date time.Time) (money.Rate, bool, error)
}

// Contract is a fixed income application's security (A236 FC11, FC12).
type Contract struct {
	Code                       money.Currency
	Currency                   money.Currency // the brokerage currency
	Subtype, Name              string
	IssuerName, IssuerScheme   string
	IssuerID                   string
	IssuedOn, MaturesOn        time.Time
	IndexID                    string
	PercentOfIndexBP, SpreadBP int
	DayCount, CalendarID       string
	DailyLiquidity             bool
	RedeemableFrom             time.Time
	Region                     string // the book's region, for the defaults
	Payments                   []Payment
	InterestEveryMonths        int       // expands into a schedule merged with Payments
	FirstPaymentOn             time.Time // required with InterestEveryMonths
}

// Payment is a date on which a contract pays interest, returns principal or both (A236 FC6).
type Payment struct {
	PaysOn         time.Time
	AmortizationBP int
	PaysInterest   bool
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
	At                *time.Time
	Open              bool
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
	WithholdingBP(region, incomeType string, date time.Time) int
	ReserveYieldPercent(currency money.Currency) int64
	SeparatesDayTrades(region string) bool
	CostMethod(region, instrumentType string) string
	FixedIncomeWithholding(region, instrumentType, subtype string) (domain.WithholdingTable, bool)
	CustodyFee(region, instrumentType, subtype, code string) (domain.CustodyRule, bool)
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
