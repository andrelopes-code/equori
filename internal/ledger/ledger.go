// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/ledger/httpapi"
	"github.com/andrelopes-code/equori/internal/ledger/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/toolapi"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
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

type Module struct {
	http *httpapi.Server
	svc  *app.Service
}

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

// Calendar is the part of marketdata the ledger uses to shift due dates.
// MarketData is satisfied by *marketdata.Module: business days and instruments.
type MarketData interface {
	Adjust(ctx context.Context, name string, d time.Time, a marketdata.Adjustment) (time.Time, error)
	Instrument(ctx context.Context, code string) (marketdata.Instrument, error)
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (marketdata.Conversion, error)
	DefaultCalendar(region string) string
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

// CaptureAccount is a balance account with the names a capture line may use for it.
type CaptureAccount = app.CaptureAccount

type CapturePayee = app.CapturePayee

// InstallmentConfirmation is what an aggregator line reports about its installment (A90).
type InstallmentConfirmation = app.InstallmentConfirmation

// StatementFacts is what an institution reports for a card statement (A85).
type StatementFacts = app.StatementFacts

// GroupPart is one line of a group that confirms an entry (A169).
type GroupPart = app.GroupPart

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, md MarketData, profiles Profiles, clk clock.Clock, log *slog.Logger) *Module {
	ins := &instruments{md: md, cache: map[money.Currency]app.Instrument{}}
	svc := app.NewService(postgres.NewRepository(pool, ins), clk, calendarAdapter{md}, ins, pricesAdapter{md}, profiles, regionDefaults{})

	dispatcher.Subscribe("ledger-provisioning", "identity.books_created.v1", provision)
	// A139: a change on a card may close a reported statement's difference; the bank sends the
	// bill once, so the ledger settles again after every change rather than at the next bill.
	for _, event := range []string{app.EventTransactionRecorded, app.EventTransactionCorrected, app.EventTransactionVoided} {
		dispatcher.Subscribe("ledger-statement-settlement", event, settleCards(svc))
	}

	return &Module{http: httpapi.NewServer(svc, log), svc: svc}
}

// Tools returns the ledger's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// Today is the date of the ledger's clock (A81 previews read it).
func (m *Module) Today(ctx context.Context) time.Time { return m.svc.Today(ctx) }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of attachment uploads: 10 MiB of content
// plus the multipart framing (N26).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/transactions/{id}/attachments", Bytes: 11 << 20}}
}
