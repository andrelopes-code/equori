package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Event types published by the ledger (ADR 006).
const (
	EventTransactionRecorded  = app.EventTransactionRecorded
	EventTransactionCorrected = app.EventTransactionCorrected
	EventTransactionVoided    = app.EventTransactionVoided
	// EventTransactionCategorized follows Categorize (P5 amendment A18).
	EventTransactionCategorized = app.EventTransactionCategorized
	// EventTransactionsPaired follows a Transfer that pairs two transactions (P5b amendment A29).
	EventTransactionsPaired = app.EventTransactionsPaired
	// EventCategoriesMerged follows MergeCategories (A75).
	EventCategoriesMerged = app.EventCategoriesMerged
	// EventPayeesMerged follows MergePayees (A82).
	EventPayeesMerged = app.EventPayeesMerged
	// EventTagRenamed follows RenameTag and MergeTag.
	EventTagRenamed = app.EventTagRenamed
	// EventTagDeleted follows DeleteTag.
	EventTagDeleted = app.EventTagDeleted
	// CauseMerge is the cause method of the versions a merge creates.
	CauseMerge = app.CauseMerge
)

// WithholdingEstimate is the income tax, the IOF and the net of a sale of a taxed security.
type WithholdingEstimate = app.WithholdingEstimate

// Errors returned to other modules.
var (
	ErrNotFound          = app.ErrNotFound
	ErrValidation        = domain.ErrValidation
	ErrVoided            = domain.ErrVoided
	ErrAlreadyReconciled = domain.ErrAlreadyReconciled
	// ErrInstallmentUnavailable refuses a line for an installment (P6 A40).
	ErrInstallmentUnavailable = app.ErrInstallmentUnavailable
	ErrAlreadyMatched         = app.ErrAlreadyMatched
	ErrVersionConflict        = domain.ErrVersionConflict
	ErrNotCategorizable       = domain.ErrNotCategorizable
	ErrPairingAmbiguous       = app.ErrPairingAmbiguous
	ErrNotPairable            = app.ErrNotPairable
	ErrNotUnpairable          = app.ErrNotUnpairable
	ErrReconciled             = domain.ErrReconciled
	ErrNotRetypable           = domain.ErrNotRetypable
	ErrMixedInstruments       = app.ErrMixedInstruments
	ErrPriceMissing           = app.ErrPriceMissing
	ErrNotGroupable           = app.ErrNotGroupable
)

// TransactionEvent is the payload of the transaction events.
type TransactionEvent = app.TransactionEvent

// CategoriesMerged is the payload of EventCategoriesMerged.
type CategoriesMerged = app.CategoriesMerged

// PayeesMerged is the payload of EventPayeesMerged.
type PayeesMerged = app.PayeesMerged

// TagRenamed is the payload of EventTagRenamed.
type TagRenamed = app.TagRenamed

// TagDeleted is the payload of EventTagDeleted.
type TagDeleted = app.TagDeleted

// ImportedPosting is one statement line of a balance account, normalized by Ingestion.
type ImportedPosting = app.ImportedPosting

type ImportTarget = app.ImportTarget

type ImportedUpdate = app.ImportedUpdate

type ImportedInstallment = app.ImportedInstallment

// ImportedRecord is a statement line and the external record it comes from.
type ImportedRecord = app.ImportedRecord

// ImportDecision is Classification's decision for an imported line (P5 amendment A19).
type ImportDecision = app.ImportDecision

// Facts that Portfolio reads (P8 amendment A71).
type (
	InvestmentFacts = app.InvestmentFacts
	SecurityFact    = app.SecurityFact
	HoldingPosting  = app.HoldingPosting
	TradeFact       = app.TradeFact
	IncomeFact      = app.IncomeFact
)

// Facts that Classification reads (P5 amendments A17, A23, A26).
type (
	TransactionFacts = app.TransactionFacts
	FactPosting      = app.FactPosting
	AccountFact      = app.AccountFact
	RecordedItem     = app.RecordedItem
	RecordedYield    = app.RecordedYield
	YieldPeriod      = app.YieldPeriod
	AccountCheck     = app.AccountCheck
	PayeeClass       = app.PayeeClass
)

// Conversion is a valued amount with the prices it used; Price is one of them (P8 amendment A65).
type (
	Conversion = app.Conversion
	Price      = app.Price
	ValuedPart = app.ValuedPart
	// ExternalFlow is money that entered or left an account tree (investments design 4.3).
	ExternalFlow = app.ExternalFlow
	// AccountBalance is the balance of one balance-sheet account in its own instrument.
	AccountBalance = app.Balance
)

// Match links an external record to the transaction it confirms.
type Match = app.Match

// CategoryPart is one category posting of a categorization, signed like the posting.
type CategoryPart = domain.CategoryPart

// Cause names who decided a categorization; the categorized event carries it.
type Cause = app.Cause

// Categorization changes the category side of one transaction (P5 amendment A18).
type Categorization = app.Categorization

// TransferRequest and TransferResult describe Transfer (P5b amendments A28, A29).
type (
	TransferRequest = app.TransferRequest
	TransferResult  = app.TransferResult
	PairedEvent     = app.PairedEvent
)

// Counterpart and CounterpartQuery describe Counterparts (A216 rule 2).
type (
	Counterpart      = app.Counterpart
	CounterpartQuery = app.CounterpartQuery
)

// LineError names the line of a batch that a ledger rule rejected.
type LineError = app.LineError

// MarketData is the part of marketdata the ledger uses to shift due dates and value
// instruments. *marketdata.Module satisfies it.
type MarketData interface {
	Adjust(
		ctx context.Context,
		name string,
		d time.Time,
		a marketdata.Adjustment,
	) (time.Time, error)
	Instrument(ctx context.Context, code string) (marketdata.Instrument, error)
	ResolveCode(ctx context.Context, code string) (string, error)
	SettlementDate(ctx context.Context, code string, date time.Time) (time.Time, error)
	Convert(
		ctx context.Context,
		q money.Money,
		to money.Currency,
		date time.Time,
	) (marketdata.Conversion, error)
	WarmCurrent(ctx context.Context, codes []money.Currency)
	ConvertCurrent(
		ctx context.Context,
		q money.Money,
		to money.Currency,
	) (marketdata.Conversion, error)
	DefaultCalendar(region string) string
	CheckContract(
		ctx context.Context,
		booksID int64,
		c marketdata.Contract,
		applicationID uuid.UUID,
	) (marketdata.Contract, error)
	DefineContract(ctx context.Context, booksID int64, c marketdata.Contract) error
	DiscardContract(ctx context.Context, booksID int64, code money.Currency) error
	PriceOnOrBefore(
		ctx context.Context,
		instrument, quote money.Currency,
		date time.Time,
	) (marketdata.Price, bool, error)
}

// Profiles is the part of identity the ledger uses to default a card's calendar.
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// UnlinkedPosting is a posting a statement line may confirm.
type UnlinkedPosting = app.UnlinkedPosting

// CategoryMonth is the total of a category's own postings in one month.
type CategoryMonth struct {
	CategoryID uuid.UUID
	Month      time.Time
	Total      money.Money
}

// CategoryPosting is one own posting of a category: its weight in the base currency.
type CategoryPosting struct {
	TransactionID, CategoryID uuid.UUID
	BookedOn                  time.Time
	Amount                    money.Money
	Description, Payee        string
}

// CaptureAccount is a balance account with the names a capture line may use for it.
type CaptureAccount = app.CaptureAccount

type CapturePayee = app.CapturePayee

// InstallmentConfirmation is what an aggregator line reports about its installment (A90).
type InstallmentConfirmation = app.InstallmentConfirmation

// StatementFacts is what an institution reports for a card statement (A85).
type StatementFacts = app.StatementFacts

// GroupPart is one line of a group that confirms an entry (A169).
type GroupPart = app.GroupPart
