package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ColumnSuggester asks a model for the meaning of columns; it receives masked cells only.
type ColumnSuggester interface {
	SuggestColumns(ctx context.Context, sample domain.ColumnSample) (domain.ColumnPositions, error)
}

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	// Open returns an error for a value that another key, row or tampering produced.
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// Aggregator reads an aggregator application with an integration's credentials and may
// cache one API key per integration. Errors: ErrAggregatorUnauthorized, ErrItemNotFound, or
// one wrapping ErrAggregatorUnavailable; none names an identifier (A44). An external account's
// ExternalID stays the same while the institution keeps the account, and a rename keeps it; a
// line of a reserved balance sets ReserveMove, with ReserveExternalID or ReserveName when the
// source gives them (A211). aggregatortest.Run checks this contract.
type Aggregator interface {
	ID() string
	Name() string
	CredentialFields() []domain.CredentialField
	// ConnectMethod names how a connection is created: "reference" takes the item reference
	// of an application the owner connected elsewhere.
	ConnectMethod() string
	MinSyncInterval() time.Duration
	// State reads the status an aggregator reports for a connection.
	State(providerStatus string) domain.ConnectionState
	// Portal names the site or app where the owner acts on an item, empty when there is none.
	Portal() string
	// Verify creates an API key from the credentials, replacing any cached one.
	Verify(ctx context.Context, integrationID uuid.UUID, c domain.Credentials) error
	// Item returns the item as an unsaved connection with its accounts.
	Item(
		ctx context.Context,
		integrationID uuid.UUID,
		c domain.Credentials,
		itemID string,
	) (domain.Connection, error)
	// Accounts lists the item's external accounts, reserved balances included.
	Accounts(
		ctx context.Context,
		integrationID uuid.UUID,
		c domain.Credentials,
		itemID string,
	) ([]domain.ExternalAccount, error)
	// ItemState returns the item's status, last update and next automatic update.
	ItemState(
		ctx context.Context,
		integrationID uuid.UUID,
		c domain.Credentials,
		itemID string,
	) (ItemState, error)
	// ReadAccount returns an account of the item with its lines dated in [from, to], in minor
	// units of scale; with createdFrom, also the lines the aggregator created at or after it,
	// in Created (A144). ErrAccountGone when the item no longer lists the account. A reserved
	// balance is found by its identification and read without lines (A74).
	ReadAccount(
		ctx context.Context,
		integrationID uuid.UUID,
		c domain.Credentials,
		itemID, accountID string,
		from, to time.Time,
		createdFrom *time.Time,
		scale int,
	) (domain.AccountRead, error)
	Forget(integrationID uuid.UUID)
}

// InvestmentReader is the optional part of an Aggregator that reads investments (A236 FC27).
type InvestmentReader interface {
	Investments(
		ctx context.Context,
		integrationID uuid.UUID,
		c domain.Credentials,
		itemID string,
	) ([]domain.ExternalInvestment, error)
}

// Ledger is the part of package ledger an import uses; the module root adapts it. Each call
// is one database transaction of the ledger (ADR 002).
type Ledger interface {
	// ImportTarget returns ErrNotFound for an unknown account and a *domain.FieldError on
	// account_id for an account that cannot hold statement lines.
	ImportTarget(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) (domain.ImportTarget, error)
	// LinkedTransaction returns ErrNotFound when no transaction carries the record.
	LinkedTransaction(
		ctx context.Context,
		booksID int64,
		recordID uuid.UUID,
	) (txID uuid.UUID, imported bool, err error)
	// UnlinkedPostings lists the account's postings in [from, to] that no external record
	// confirms and whose transaction is not voided.
	UnlinkedPostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]domain.LedgerPosting, error)
	// UnconfirmedPostings lists the account's postings that neither a line nor a balance
	// confirms, dated by when the institution reports them (A133).
	UnconfirmedPostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]domain.LedgerPosting, error)
	// LinePayees returns the payee classification decides for each line, uuid.Nil for none,
	// in input order (A99).
	LinePayees(ctx context.Context, booksID int64, lines []Line) ([]uuid.UUID, error)
	// RecordImported creates the transactions of the lines, ids in input order; a refused
	// line is a *RejectedLine and creates none.
	RecordImported(ctx context.Context, booksID int64, lines []NewLine) ([]uuid.UUID, error)
	// ConfirmLine corrects the transaction to the line's amount and date (A101); a voided
	// transaction is ErrTransactionVoided and a reconciled posting ErrReconciled.
	ConfirmLine(
		ctx context.Context,
		booksID int64,
		txID, accountID uuid.UUID,
		amount int64,
		date time.Time,
	) error
	// GroupableTransactions returns the transactions among txIDs that a group may take over (A167).
	GroupableTransactions(
		ctx context.Context,
		booksID int64,
		txIDs []uuid.UUID,
	) ([]uuid.UUID, error)
	// ConfirmGroup confirms the entry by the lines of a group (A169); ErrGroupChanged when the
	// entry cannot take one.
	ConfirmGroup(
		ctx context.Context,
		booksID int64,
		txID, accountID uuid.UUID,
		parts []GroupPart,
	) error
	// MoveReconciledDate moves a transaction with a reconciled card posting to the line's date
	// when every reconciled posting keeps its statement (A147); else ErrReconciled.
	MoveReconciledDate(
		ctx context.Context,
		booksID int64,
		txID, accountID uuid.UUID,
		date time.Time,
	) error
	// ClearMatched links the matches and returns the indexes of those whose transaction
	// already carries another record.
	ClearMatched(ctx context.Context, booksID int64, ms []Match) (conflicts []int, err error)
	AssertBalance(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		b domain.Balance,
		c money.Currency,
	) error
	// AssertSyncedBalance records an aggregator balance without yield (P6 A42); a refused
	// assertion wraps ErrBalanceRejected.
	AssertSyncedBalance(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		b domain.Balance,
		c money.Currency,
	) error
	// LastBalanceReconciledOn returns the date of the account's latest reconciled balance
	// assertion, nil for none (A261).
	LastBalanceReconciledOn(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) (*time.Time, error)
	// AssertSyncedReserve is AssertSyncedBalance for a reserved balance, which books bounded
	// yield on a positive difference (A75).
	AssertSyncedReserve(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		b domain.Balance,
		c money.Currency,
	) error
	// UpdateImportedPosting applies a later report on a recorded line (A36) and reports
	// whether the posting changed. A reconciled posting that already holds the reported
	// status and bill is (false, nil) (A147); one that does not is ErrReconciled. kind
	// KindPayment retypes a card credit as a payment; ErrNotRetypable when the transaction
	// changed since its import. ErrNotFound when no posting carries the record.
	UpdateImportedPosting(
		ctx context.Context,
		booksID int64,
		recordID uuid.UUID,
		pending bool,
		dueDate *time.Time,
		kind string,
	) (bool, error)
	// RecordStatementFacts records a card bill on the ledger statement due on its due date (A85).
	RecordStatementFacts(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		b domain.Bill,
		c money.Currency,
	) error
	// RecordCardOpening opens a card that has no opening balance with the total of the bill
	// before its first synced cycle, billed on that bill's statement (A93).
	RecordCardOpening(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		b domain.Bill,
		c money.Currency,
	) error
	// SettleReportedStatements moves pending card postings off reported statements and
	// reconciles the reported statements that match (A90, A92).
	SettleReportedStatements(ctx context.Context, booksID int64, accountID uuid.UUID) error
	// ReleaseRecord unlinks a withdrawn record from its posting (A38).
	ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error
	// RecordInstallment creates the installment purchase of the first line seen of it and
	// returns its transaction and plan (A40); a refused line wraps ErrInstallmentRefused.
	RecordInstallment(
		ctx context.Context,
		booksID int64,
		l InstallmentLine,
	) (txID, planID uuid.UUID, err error)
	// LinkInstallment links a line to installment number of a plan and returns its
	// transaction; ErrInstallmentRefused when the installment is gone, reversed, of another
	// amount or confirmed by another line.
	LinkInstallment(
		ctx context.Context,
		booksID int64,
		recordID, planID uuid.UUID,
		number int,
		l Line,
	) (uuid.UUID, error)
	// RuleDecided reports, per line in input order, whether a rule of the owner decides its
	// category (A216 rule 1.4).
	RuleDecided(ctx context.Context, booksID int64, lines []Line) ([]bool, error)
	// Counterparts lists the transactions of rule 2 of A216 for the line, by date then id.
	Counterparts(ctx context.Context, booksID int64, l Line) ([]Counterpart, error)
	// PairLine makes txID the transfer of the record's line on accountID and returns the version
	// it gave the transaction (A218 rule 1); ErrNotPairable when the ledger refuses.
	PairLine(ctx context.Context, booksID int64, txID, accountID, recordID uuid.UUID) (int, error)
	// ApplyInvestment records the first application or a contribution of an investment.
	ApplyInvestment(
		ctx context.Context,
		booksID int64,
		a InvestmentApplication,
	) (AppliedInvestment, error)
	// SellInvestment records the redemption of an amount of an investment.
	SellInvestment(ctx context.Context, booksID int64, s InvestmentSale) (uuid.UUID, error)
	// InvestmentIncome records interest paid on an investment.
	InvestmentIncome(ctx context.Context, booksID int64, i InvestmentIncome) (uuid.UUID, error)
	// VoidInvestment voids a transaction of an investment.
	VoidInvestment(ctx context.Context, booksID int64, txID uuid.UUID) error
	// HeldUnits is the quantity the account holds at the end of the date.
	HeldUnits(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		on time.Time,
	) (money.Money, error)
	// UnpairLine returns txID, paired at version, to its previous postings as a new version
	// (A220 rule 2); ErrNotUnpairable when it changed since or the ledger refuses.
	UnpairLine(ctx context.Context, booksID int64, txID, recordID uuid.UUID, version int) error
}

// Admins tells whether a member holds the admin instance role.
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}
