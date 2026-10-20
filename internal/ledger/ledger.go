// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// DefaultBaseCurrency is the base currency of a new user; it can change until the first transaction.
const DefaultBaseCurrency = "BRL"

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
	// CauseMerge is the cause method of the versions a merge creates.
	CauseMerge = app.CauseMerge
)

// TransactionEvent is the payload of the transaction events.
type TransactionEvent = app.TransactionEvent

// CategoriesMerged is the payload of EventCategoriesMerged.
type CategoriesMerged = app.CategoriesMerged

// PayeesMerged is the payload of EventPayeesMerged.
type PayeesMerged = app.PayeesMerged

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
	PayeeClass       = app.PayeeClass
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

// LineError names the line of a batch that a ledger rule rejected.
type LineError = app.LineError

// Errors returned to other modules.
var (
	ErrNotFound          = app.ErrNotFound
	ErrValidation        = domain.ErrValidation
	ErrVoided            = domain.ErrVoided
	ErrAlreadyReconciled = domain.ErrAlreadyReconciled
	// ErrInstallmentUnavailable and ErrAmountMismatch refuse a line for an installment (P6 A40).
	ErrInstallmentUnavailable = app.ErrInstallmentUnavailable
	ErrAmountMismatch         = app.ErrAmountMismatch
	ErrAlreadyMatched         = app.ErrAlreadyMatched
	ErrVersionConflict        = domain.ErrVersionConflict
	ErrNotCategorizable       = domain.ErrNotCategorizable
	ErrPairingAmbiguous       = app.ErrPairingAmbiguous
	ErrReconciled             = domain.ErrReconciled
	ErrNotRetypable           = domain.ErrNotRetypable
	ErrMixedInstruments       = app.ErrMixedInstruments
)

// Calendar is the part of marketdata the ledger uses to shift due dates.
// MarketData is satisfied by *marketdata.Module: business days and instruments.
type MarketData interface {
	Adjust(ctx context.Context, name string, d time.Time, a marketdata.Adjustment) (time.Time, error)
	Instrument(ctx context.Context, code string) (marketdata.Instrument, error)
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (marketdata.Conversion, error)
}

type pricesAdapter struct{ md MarketData }

func (p pricesAdapter) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (app.Conversion, error) {
	c, err := p.md.Convert(ctx, q, to, date)
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return app.Conversion{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}
	if err != nil {
		return app.Conversion{}, err
	}
	out := app.Conversion{Value: c.Value, Prices: make([]app.Price, len(c.Prices))}
	for i, x := range c.Prices {
		out.Prices[i] = app.Price{Instrument: x.Instrument, Quote: x.Quote, Date: x.Date, Value: x.Value, Source: x.Source}
	}
	return out, nil
}

type calendarAdapter struct{ cal MarketData }

func (c calendarAdapter) Adjust(ctx context.Context, name string, d time.Time, adjustment string) (time.Time, error) {
	return c.cal.Adjust(ctx, name, d, marketdata.Adjustment(adjustment))
}

// instruments caches Market data instruments for the module's lifetime: code, type,
// scale and quote currency are immutable (P8 amendment A59).
type instruments struct {
	md    MarketData
	mu    sync.Mutex
	cache map[money.Currency]app.Instrument
}

func (c *instruments) Instrument(ctx context.Context, code money.Currency) (app.Instrument, error) {
	c.mu.Lock()
	in, ok := c.cache[code]
	c.mu.Unlock()
	if ok {
		return in, nil
	}
	m, err := c.md.Instrument(ctx, string(code))
	if errors.Is(err, marketdata.ErrUnknownInstrument) {
		return app.Instrument{}, app.ErrUnknownInstrument
	}
	if err != nil {
		return app.Instrument{}, err
	}
	in = app.Instrument{Code: m.Code, Scale: m.Scale, QuoteCurrency: m.QuoteCurrency}
	c.mu.Lock()
	c.cache[code] = in
	c.mu.Unlock()
	return in, nil
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, md MarketData, clk clock.Clock, log *slog.Logger) *Module {
	ins := &instruments{md: md, cache: map[money.Currency]app.Instrument{}}
	svc := app.NewService(postgres.NewRepository(pool, ins), clk, calendarAdapter{md}, ins, pricesAdapter{md})
	dispatcher.Subscribe("ledger-provisioning", "identity.user_created.v1", provision)
	return &Module{http: httpapi.NewServer(svc, log), svc: svc}
}

// RecordImported creates the transaction of an external record; it is idempotent by recordID
// (P4 amendments A11, A14).
// Today is the date of the ledger's clock (A81 previews read it).
func (m *Module) Today() time.Time { return m.svc.Today() }

func (m *Module) RecordImported(ctx context.Context, userID int64, recordID uuid.UUID, p ImportedPosting) (uuid.UUID, error) {
	return m.svc.RecordImported(ctx, userID, recordID, p)
}

// ImportTarget returns the currency and kind of an account that can hold statement lines;
// an account that cannot is an ErrValidation.
func (m *Module) ImportTarget(ctx context.Context, userID int64, accountID uuid.UUID) (ImportTarget, error) {
	return m.svc.ImportTarget(ctx, userID, accountID)
}

// LinkedTransaction returns the transaction carrying an external record and whether the
// import created it; ErrNotFound when none carries it.
func (m *Module) LinkedTransaction(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, bool, error) {
	return m.svc.LinkedTransaction(ctx, userID, recordID)
}

// RecordImportedBatch creates the transactions of many external records in one database
// transaction; ids follow the input order and a rejected line is a *LineError.
func (m *Module) RecordImportedBatch(ctx context.Context, userID int64, recs []ImportedRecord) ([]uuid.UUID, error) {
	return m.svc.RecordImportedBatch(ctx, userID, recs)
}

// ClearMatchedBatch links records to transactions in one database transaction and returns
// the indexes of the matches whose transaction meanwhile carries another record.
func (m *Module) ClearMatchedBatch(ctx context.Context, userID int64, ms []Match) ([]int, error) {
	return m.svc.ClearMatchedBatch(ctx, userID, ms)
}

// UnlinkedPosting is a posting a statement line may confirm.
type UnlinkedPosting = app.UnlinkedPosting

// UnlinkedPostings lists the account's postings in [from, to] that no external record
// confirms yet and whose transaction is not voided.
func (m *Module) UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error) {
	return m.svc.UnlinkedPostings(ctx, userID, accountID, from, to)
}

// ClearMatched links an external record to a transaction and clears its pending postings.
func (m *Module) ClearMatched(ctx context.Context, userID int64, recordID, txID, accountID uuid.UUID) error {
	return m.svc.ClearMatched(ctx, userID, recordID, txID, accountID)
}

// AssertBalance records a balance reported by an imported file (source import, F6).
// Categorize applies each item in one database transaction; errs[i] is the domain error of
// item i (ErrNotFound, ErrVersionConflict, ErrNotCategorizable, ErrVoided, ErrValidation).
func (m *Module) Categorize(ctx context.Context, userID int64, cs []Categorization) (errs []error, err error) {
	return m.svc.Categorize(ctx, userID, cs)
}

// TransactionFacts returns the facts of the user's transactions among ids in the order of
// ids; unknown ids are omitted.
func (m *Module) TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]TransactionFacts, error) {
	return m.svc.TransactionFacts(ctx, userID, ids)
}

// Balance returns the booked balance of an account at the end of date, as GET
// /accounts/{id}/balance reads it.
func (m *Module) Balance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time) (money.Money, error) {
	b, err := m.svc.BalanceAt(ctx, userID, accountID, date, app.BasisBooked)
	return b.Amount, err
}

// Commitment is the sum of installments billed on the statement of month while it is open
// (P2; P7 amendment A57).
func (m *Module) Commitment(ctx context.Context, userID int64, accountID uuid.UUID, month time.Time) (money.Money, error) {
	return m.svc.Commitment(ctx, userID, accountID, domain.MonthOf(month))
}

// CategoryMonthlyTotals is CategoryTotal for each month in [from, to), keyed by its first day.
func (m *Module) CategoryMonthlyTotals(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]money.Money, error) {
	return m.svc.CategoryMonthlyTotals(ctx, userID, categoryID, from, to)
}

// CategoryTotal sums the postings of a category subtree booked in [from, to), in the base
// currency (P7 amendment A54).
func (m *Module) CategoryTotal(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (money.Money, error) {
	return m.svc.CategoryTotal(ctx, userID, categoryID, from, to)
}

// InvestmentFacts returns the facts Portfolio derives from: the children of brokerageID
// that hold a security, their postings, trades and income (P8 amendment A71).
func (m *Module) InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (InvestmentFacts, error) {
	return m.svc.InvestmentFacts(ctx, userID, brokerageID)
}

// BaseCurrency returns the user's base currency, as GET /settings reads it.
func (m *Module) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	s, err := m.svc.Settings(ctx, userID)
	return s.BaseCurrency, err
}

func (m *Module) AccountFacts(ctx context.Context, userID int64) ([]AccountFact, error) {
	return m.svc.AccountFacts(ctx, userID)
}

// MissingPayees returns the ids that are not payees of the user.
func (m *Module) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return m.svc.MissingPayees(ctx, userID, ids)
}

// LatestPayeeCategories implements the payee history of P5 amendment A23.
func (m *Module) LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[PayeeClass]uuid.UUID, error) {
	return m.svc.LatestPayeeCategories(ctx, userID, payees)
}

// Transfer replaces the category side of a transaction with a posting on another account,
// pairing it with the imported other side when one exists.
func (m *Module) Transfer(ctx context.Context, userID int64, r TransferRequest) (TransferResult, error) {
	return m.svc.Transfer(ctx, userID, r)
}

// AssertSyncedBalance records an aggregator's balance, or decides the open assertion of the
// same date and amount again; it never records yield (P6 A42, A77).
func (m *Module) AssertSyncedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error {
	_, err := m.svc.AssertSynced(ctx, userID, accountID, date, amount, false)
	return err
}

// AssertSyncedReserve is AssertSyncedBalance for a reserved balance: a positive difference
// within the yield bound of an account with automatic yield is booked as yield (A75).
func (m *Module) AssertSyncedReserve(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error {
	_, err := m.svc.AssertSynced(ctx, userID, accountID, date, amount, true)
	return err
}

// UpdateImportedPosting applies an aggregator's later report on a recorded line (P6 A36);
// a reconciled posting is ErrReconciled.
func (m *Module) UpdateImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID, u ImportedUpdate) error {
	return m.svc.UpdateImportedPosting(ctx, userID, recordID, u)
}

// RecordImportedInstallment creates the installment purchase of an aggregator line (P6 A40).
func (m *Module) RecordImportedInstallment(ctx context.Context, userID int64, in ImportedInstallment) (txID, planID uuid.UUID, err error) {
	return m.svc.RecordImportedInstallment(ctx, userID, in)
}

// LinkInstallment links an aggregator line to installment number of a plan (P6 A40).
func (m *Module) LinkInstallment(ctx context.Context, userID int64, recordID, planID uuid.UUID, number int, amount money.Money) (uuid.UUID, error) {
	return m.svc.LinkInstallment(ctx, userID, recordID, planID, number, amount)
}

// ReleaseRecord unlinks a withdrawn record from its posting (P6 A38).
func (m *Module) ReleaseRecord(ctx context.Context, userID int64, recordID uuid.UUID) error {
	return m.svc.ReleaseRecord(ctx, userID, recordID)
}

func (m *Module) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error {
	_, err := m.svc.AssertBalance(ctx, userID, accountID, date, amount, app.SourceImport)
	return err
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of attachment uploads: 10 MiB of content
// plus the multipart framing (N26).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/transactions/{id}/attachments", Bytes: 11 << 20}}
}

type userCreated struct {
	UserID int64 `json:"user_id"`
}

// provision runs in the dispatcher's transaction, so the system accounts commit with the delivery.
func provision(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p userCreated
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	svc := app.NewService(postgres.NewRepository(tx, nil), clock.New(time.UTC, time.Now), nil, nil, nil)
	return svc.Provision(ctx, p.UserID, DefaultBaseCurrency)
}
