// Package app implements the ledger use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrNonZeroBalance     = errors.New("account balance is not zero")
	ErrPostingsAfterClose = errors.New("account has postings after the closing date")
	ErrSettingsLocked     = errors.New("settings cannot change after the first transaction")
	ErrStatementNotClosed = errors.New("statement has not closed yet")
	ErrStatementFinanced  = errors.New("statement is already financed")
	ErrDisputeOpen        = errors.New("the transaction already has an open dispute")
	ErrDisputeResolved    = errors.New("the dispute is already resolved")
)

// Clock is satisfied by platform/clock.Clock.
type Clock interface {
	Now() time.Time
	Today() time.Time
}

// Calendar shifts due dates to business days (marketdata, P2 amendment A2).
type Calendar interface {
	Adjust(ctx context.Context, calendar string, d time.Time, adjustment string) (time.Time, error)
}

type CreditLimit struct {
	AccountID     uuid.UUID
	EffectiveFrom time.Time
	Amount        money.Money
}

type CardSummary struct {
	CreditLimit    money.Money
	AvailableLimit money.Money
}

// Statement is a stored statement with the lines its summary is derived from.
type Statement struct {
	ID         uuid.UUID
	AccountID  uuid.UUID
	FinancedBy uuid.UUID
	Input      domain.StatementInput
}

// StatementPosting is one posting billed on a statement, with its transaction context.
type StatementPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Description   string
	CardRole      string
	Amount        int64
	Installment   *domain.InstallmentRef
}

// PlanInstallment is one installment of a plan with the statement it is billed on.
type PlanInstallment struct {
	Number    int
	Amount    int64 // negative: a charge
	Reference domain.ReferenceMonth
	Closing   time.Time
}

type Dispute struct {
	ID                  uuid.UUID
	UserID              int64
	TransactionID       uuid.UUID
	OpenedOn            time.Time
	ResolvedOn          *time.Time
	Outcome             string
	RefundTransactionID uuid.UUID
}

type Settings struct {
	UserID       int64
	BaseCurrency money.Currency
}

type Institution struct {
	ID     uuid.UUID
	UserID int64
	Name   string
	Code   string
}

type Payee struct {
	ID     uuid.UUID
	UserID int64
	Name   string
}

type Version struct {
	Version     int
	Reason      string
	ReplacedAt  time.Time
	Transaction domain.Transaction
}

type AccountTotals struct {
	Total        int64
	LastBookedOn time.Time
}

// Basis selects the date that places a posting in time: the transaction date or the
// institution's settlement date (chapter 5, 5.2.3).
type Basis string

const (
	BasisBooked  Basis = "booked"
	BasisSettled Basis = "settled"
)

type Balance struct {
	AccountID uuid.UUID
	Date      time.Time
	Basis     Basis
	Amount    money.Money
}

type TransactionCursor struct {
	Date time.Time `json:"d"`
	ID   uuid.UUID `json:"i"`
}

type TransactionQuery struct {
	UserID    int64
	AccountID uuid.UUID
	PayeeID   uuid.UUID
	Tag       string
	From, To  *time.Time
	After     *TransactionCursor
	Limit     int
}

// Repository returns ErrNotFound for missing rows. Publish is valid only inside InTx.
type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	Publish(ctx context.Context, e outbox.Event) error

	Settings(ctx context.Context, userID int64) (Settings, error)
	SaveSettings(ctx context.Context, s Settings) error
	SetSystemAccountsInstrument(ctx context.Context, userID int64, c money.Currency) error
	CountTransactions(ctx context.Context, userID int64) (int64, error)

	InsertInstitution(ctx context.Context, i Institution) (Institution, error)
	ListInstitutions(ctx context.Context, userID int64) ([]Institution, error)
	InsertPayee(ctx context.Context, p Payee) (Payee, error)
	Payee(ctx context.Context, userID int64, id uuid.UUID) (Payee, error)
	ListPayees(ctx context.Context, userID int64) ([]Payee, error)
	ListTags(ctx context.Context, userID int64) ([]string, error)

	Account(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error)
	Accounts(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]domain.Account, error)
	ListAccounts(ctx context.Context, userID int64) ([]domain.Account, error)
	InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	UpdateAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	AccountHasChildren(ctx context.Context, userID int64, id uuid.UUID) (bool, error)
	AccountTotals(ctx context.Context, userID int64, id uuid.UUID) (AccountTotals, error)

	Transaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error)
	LockTransaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error)
	InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error)
	ReplaceTransaction(ctx context.Context, prev, next domain.Transaction, reason string) error
	VoidTransaction(ctx context.Context, t domain.Transaction) error
	ListTransactions(ctx context.Context, q TransactionQuery) ([]domain.Transaction, error)
	Versions(ctx context.Context, userID int64, id uuid.UUID) ([]Version, error)

	InsertBillingRule(ctx context.Context, userID int64, accountID uuid.UUID, r domain.BillingCycleRule) (domain.BillingCycleRule, error)
	BillingRules(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Rules, error)
	InsertCreditLimit(ctx context.Context, userID int64, l CreditLimit) (CreditLimit, error)
	CreditLimits(ctx context.Context, userID int64, accountID uuid.UUID) ([]CreditLimit, error)
	InsertCard(ctx context.Context, c domain.Card) (domain.Card, error)
	Cards(ctx context.Context, userID int64, accountID uuid.UUID) ([]domain.Card, error)

	EnsureStatement(ctx context.Context, userID int64, accountID uuid.UUID, d domain.StatementDates, due time.Time) (uuid.UUID, error)
	Statements(ctx context.Context, userID int64, accountID uuid.UUID) ([]Statement, error)
	StatementAccount(ctx context.Context, userID int64, statementID uuid.UUID) (uuid.UUID, error)
	OpenStatementsFrom(ctx context.Context, userID int64, accountID uuid.UUID, from domain.ReferenceMonth, today time.Time) ([]Statement, error)
	UpdateStatementDates(ctx context.Context, id uuid.UUID, closing, due time.Time) error
	InsertPlan(ctx context.Context, p domain.InstallmentPlan) error
	SetStatementFinanced(ctx context.Context, statementID, planID uuid.UUID) error
	Plan(ctx context.Context, userID int64, id uuid.UUID) (domain.InstallmentPlan, error)
	PlanInstallments(ctx context.Context, userID int64, planID uuid.UUID) ([]PlanInstallment, error)
	RefundedTotal(ctx context.Context, userID int64, originID uuid.UUID) (int64, error)
	InsertDispute(ctx context.Context, d Dispute) (Dispute, error)
	LockDispute(ctx context.Context, userID int64, id uuid.UUID) (Dispute, error)
	ResolveDispute(ctx context.Context, d Dispute) (Dispute, error)
	SystemAccount(ctx context.Context, userID int64, role domain.SystemRole) (domain.Account, error)
	CommittedInstallments(ctx context.Context, userID int64, accountID uuid.UUID, month domain.ReferenceMonth, today time.Time) (int64, error)
	StatementPostings(ctx context.Context, userID int64, statementID uuid.UUID) ([]StatementPosting, error)

	// BalanceAt sums the postings of the account and its descendants up to and including date.
	BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (int64, error)
}
