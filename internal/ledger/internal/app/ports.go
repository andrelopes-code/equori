// Package app implements the ledger use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

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
	ErrDifferenceRemains  = errors.New("the settled balance still differs from the assertion")
	ErrUnknownInstrument  = errors.New("unknown instrument")
	ErrMixedInstruments   = errors.New("the account and its sub-accounts hold more than one instrument")
	ErrPriceMissing       = errors.New("price missing")
	// ErrLaterSaleExists: the change would alter the cost of a recorded sale (P8 A69).
	ErrLaterSaleExists = errors.New("a later sale of the security exists")
	// ErrInvestmentTransaction: trades and income are voided and recorded again (P8 A69).
	ErrInvestmentTransaction = errors.New("a trade or income transaction is not corrected; void it and record it again")
)

// Clock is satisfied by platform/clock.Clock.
type Clock interface {
	Now() time.Time
	Today() time.Time
}

// Instruments reads the instruments of Market data (P8 amendment A63).
type Instruments interface {
	Instrument(ctx context.Context, code money.Currency) (Instrument, error)
}

// Instrument is what Ledger needs of a Market data instrument; QuoteCurrency is empty
// for a currency.
type Instrument struct {
	Code          money.Currency
	Scale         int
	QuoteCurrency money.Currency
}

// Prices converts amounts with stored prices (Market data, P8 amendment A61); it returns
// an error wrapping ErrPriceMissing when no path exists.
type Prices interface {
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (Conversion, error)
}

type Conversion struct {
	Value  money.Money
	Prices []Price
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
	Reconciled bool // the institution's amount due was confirmed (P3 amendment A7)
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

type BalanceAssertion struct {
	ID         uuid.UUID
	UserID     int64
	AccountID  uuid.UUID
	Date       time.Time
	Amount     int64
	Source     string
	RecordedAt time.Time
	Reconciled bool
}

// Reconciliation records that an account matched its institution through Date,
// from an assertion or from a card statement (P3 amendment A7).
type Reconciliation struct {
	UserID                  int64
	AccountID               uuid.UUID
	Date                    time.Time
	AssertionID             uuid.UUID
	StatementID             uuid.UUID
	Difference              int64
	Resolution              domain.Resolution
	ResolutionTransactionID uuid.UUID
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

// Cursor keys. Member names differ between lists, so a cursor decodes only for the list
// that produced it (strict decoding in platform/page).
type (
	AccountKey struct {
		Class string    `json:"ac"`
		Name  string    `json:"an"` // lower(name), as PostgreSQL sorts it
		ID    uuid.UUID `json:"ai"`
	}
	InstitutionKey struct {
		Name string    `json:"in"`
		ID   uuid.UUID `json:"ii"`
	}
	PayeeKey struct {
		Name string    `json:"pn"`
		ID   uuid.UUID `json:"pi"`
	}
	TagKey struct {
		Name string `json:"tn"`
	}
	StatementKey struct {
		Reference string `json:"sr"`
	}
	AssertionKey struct {
		Date time.Time `json:"bd"`
		ID   uuid.UUID `json:"bi"`
	}
	AttachmentKey struct {
		CreatedAt time.Time `json:"fc"`
		ID        uuid.UUID `json:"fi"`
	}
)

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
	// Uncategorized keeps only transactions in category state uncategorized.
	Uncategorized bool
	After         *TransactionCursor
	Limit         int
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
	// List methods return the page and the key of its last row when more rows follow.
	ListInstitutions(ctx context.Context, userID int64, p page.Request[InstitutionKey]) ([]Institution, *InstitutionKey, error)
	InsertPayee(ctx context.Context, p Payee) (Payee, error)
	Payee(ctx context.Context, userID int64, id uuid.UUID) (Payee, error)
	ListPayees(ctx context.Context, userID int64, p page.Request[PayeeKey]) ([]Payee, *PayeeKey, error)
	ListTags(ctx context.Context, userID int64, p page.Request[TagKey]) ([]string, *TagKey, error)

	Account(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error)
	Accounts(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]domain.Account, error)
	ListAccounts(ctx context.Context, userID int64, p page.Request[AccountKey]) ([]domain.Account, *AccountKey, error)
	InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	UpdateAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	AccountHasChildren(ctx context.Context, userID int64, id uuid.UUID) (bool, error)
	AccountTotals(ctx context.Context, userID int64, id uuid.UUID) (AccountTotals, error)

	Transaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error)
	LockTransaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error)
	InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error)
	// InsertTransactionRows writes a validated, billed transaction without reading it back.
	InsertTransactionRows(ctx context.Context, t domain.Transaction) error
	ReplaceTransaction(ctx context.Context, prev, next domain.Transaction, reason string) error
	// ReplaceCategoryPostings stores next, which differs from prev only in its category
	// postings, payee, tags and version; other postings keep their rows.
	ReplaceCategoryPostings(ctx context.Context, prev, next domain.Transaction, reason string) error
	TransactionsByIDs(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Transaction, error)
	// RawDescriptions returns the version 1 description of the given transactions that have later versions.
	RawDescriptions(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]string, error)
	AllAccounts(ctx context.Context, userID int64) ([]domain.Account, error)
	ExistingPayees(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]struct{}, error)
	LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[PayeeClass]uuid.UUID, error)
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

	LockAccount(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error)
	InsertBalanceAssertion(ctx context.Context, a BalanceAssertion) (BalanceAssertion, error)
	BalanceAssertion(ctx context.Context, userID int64, id uuid.UUID) (BalanceAssertion, error)
	// BalanceAssertions returns the account's assertions, latest date first.
	BalanceAssertions(ctx context.Context, userID int64, accountID uuid.UUID) ([]BalanceAssertion, error)
	BalanceAssertionPage(ctx context.Context, userID int64, accountID uuid.UUID, p page.Request[AssertionKey]) ([]BalanceAssertion, *AssertionKey, error)
	LastReconciledOn(ctx context.Context, userID int64, accountID uuid.UUID) (*time.Time, error)
	FirstSettledOn(ctx context.Context, userID int64, accountID uuid.UUID) (*time.Time, error)
	// InsertReconciliation returns domain.ErrAlreadyReconciled for an assertion or statement reconciled before.
	InsertReconciliation(ctx context.Context, rec Reconciliation) error
	// ReconcilePostings marks the account's non-voided postings settled through the date as reconciled.
	ReconcilePostings(ctx context.Context, userID int64, accountID uuid.UUID, through time.Time) error
	ReconcileStatementPostings(ctx context.Context, userID int64, statementID uuid.UUID) error
	// UnlockAccount returns reconciled postings settled from the date to cleared and deletes
	// the reconciliations dated from it.
	UnlockAccount(ctx context.Context, userID int64, accountID uuid.UUID, from time.Time) error

	// InsertAttachment stores the content unless the user already has a blob with the same hash.
	InsertAttachment(ctx context.Context, a Attachment, content []byte) (Attachment, error)
	Attachments(ctx context.Context, userID int64, transactionID uuid.UUID, p page.Request[AttachmentKey]) ([]Attachment, *AttachmentKey, error)
	AttachmentContent(ctx context.Context, userID int64, id uuid.UUID) (AttachmentContent, error)
	// DeleteAttachment deletes the blob too when no other attachment references it.
	DeleteAttachment(ctx context.Context, userID int64, id uuid.UUID) error

	// TransactionByExternalRecord returns ErrNotFound when no transaction carries the record.
	TransactionByExternalRecord(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, error)
	// TransactionsByExternalRecords maps each record id that a transaction carries to it.
	TransactionsByExternalRecords(ctx context.Context, userID int64, recordIDs []uuid.UUID) (map[uuid.UUID]uuid.UUID, error)
	// LockAccountPostingLinks locks the transaction and its postings on the account and
	// returns them in position order.
	LockAccountPostingLinks(ctx context.Context, userID int64, txID, accountID uuid.UUID) ([]PostingLink, error)
	UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error)
	// LinkExternalRecord returns ErrAlreadyMatched when another posting carries the record.
	LinkExternalRecord(ctx context.Context, userID int64, postingID, recordID uuid.UUID) error
	ClearPendingPostings(ctx context.Context, userID int64, txID, accountID uuid.UUID) error
	// LockImportedPosting returns the posting an external record confirms; ErrNotFound when none.
	LockImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID) (ImportedPostingState, error)
	// SettleImportedPosting sets the posting's status and, when statementID is not nil, its statement.
	SettleImportedPosting(ctx context.Context, userID int64, postingID uuid.UUID, status domain.PostingStatus, statementID uuid.UUID) error
	ReleaseExternalRecord(ctx context.Context, userID int64, recordID uuid.UUID) error
	// RecordPosting returns the transaction and the installment plan of the posting an
	// external record confirms; ErrNotFound when none.
	RecordPosting(ctx context.Context, userID int64, recordID uuid.UUID) (txID, planID uuid.UUID, err error)
	// LockPlanInstallment returns installment number of the plan; ErrNotFound when none.
	LockPlanInstallment(ctx context.Context, userID int64, planID uuid.UUID, number int) (PlanInstallmentState, error)
	// StatementByDueDate returns the card statement due on the date; ErrNotFound when none.
	StatementByDueDate(ctx context.Context, userID int64, accountID uuid.UUID, due time.Time) (domain.ReferenceMonth, error)
	// PairingCandidates returns the ids that pair with a transfer, by date then id (P5b amendment A29).
	PairingCandidates(ctx context.Context, q PairingQuery) ([]uuid.UUID, error)
	// ClearRecordLinks removes the record links of a transaction's postings.
	ClearRecordLinks(ctx context.Context, userID int64, txID uuid.UUID) error

	// BalanceAt sums the postings of the account and its descendants up to and including date.
	BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (int64, error)
	TreeInstruments(ctx context.Context, userID int64, accountID uuid.UUID) ([]money.Currency, error)
	SecurityPostings(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]HoldingPosting, error)
	SecurityTrades(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]TradeFact, error)
	SecurityIncomes(ctx context.Context, userID int64, accountIDs []uuid.UUID) ([]IncomeFact, error)
	Holding(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time) (quantity, costBasis int64, err error)
	LaterSaleExists(ctx context.Context, userID int64, accountIDs []uuid.UUID, date time.Time, exclude uuid.UUID) (bool, error)
	TreeBalancesByInstrument(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (map[money.Currency]int64, error)
	// CategoryTotal sums the weights of the non-voided postings of the account and its
	// descendants booked in [from, to).
	CategoryTotal(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) (int64, error)
	// CategoryMonthlyTotals returns CategoryTotal by first day of month, months without postings omitted.
	CategoryMonthlyTotals(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) (map[time.Time]int64, error)
}
