package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Line is a statement line as the ledger receives it.
type Line struct {
	AccountID    uuid.UUID
	Currency     money.Currency
	Date         time.Time
	Amount       int64
	Description  string
	Pending      bool                   // the aggregator has not settled it (P6 A36)
	DueDate      *time.Time             // due date of the card bill it belongs to (A39)
	Category     *domain.SourceCategory // the aggregator's category (A41)
	TransferTo   *uuid.UUID             // the reserve the line moves money into or out of (A76)
	Kind         string                 // the card line type the source states (A88)
	Unclassified bool                   // recorded against the uncategorized account without classification (A218 rule 2)
}

// NewLine is a line to record as a transaction for its external record.
type NewLine struct {
	RecordID uuid.UUID
	Line     Line
}

// GroupPart is one line of a group that confirms an entry (A169): its record, amount, date and
// status, and the transaction the import created for it, uuid.Nil for a line without one.
type GroupPart struct {
	RecordID  uuid.UUID
	Amount    int64
	Date      time.Time
	Pending   bool
	CreatedTx uuid.UUID
}

// Match links an external record to the transaction it confirms; a pending line leaves the
// posting pending.
type Match struct {
	RecordID, TransactionID, AccountID uuid.UUID
	Pending                            bool
}

// RejectedLine is a line of a ledger batch that a ledger rule refused; it matches
// ErrLineRejected.
type RejectedLine struct {
	Index  int
	Reason error
}

func (e *RejectedLine) Error() string        { return e.Reason.Error() }
func (e *RejectedLine) Is(target error) bool { return target == ErrLineRejected }

// Ledger is the part of package ledger an import uses; the module root adapts it. Each call
// is one database transaction of the ledger (ADR 002).
type Ledger interface {
	// ImportTarget returns ErrNotFound for an unknown account and a *domain.FieldError on
	// account_id for an account that cannot hold statement lines.
	ImportTarget(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.ImportTarget, error)
	// LinkedTransaction returns ErrNotFound when no transaction carries the record.
	LinkedTransaction(ctx context.Context, booksID int64, recordID uuid.UUID) (txID uuid.UUID, imported bool, err error)
	// UnlinkedPostings lists the account's postings in [from, to] that no external record
	// confirms and whose transaction is not voided.
	UnlinkedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error)
	// UnconfirmedPostings lists the account's postings that neither a line nor a balance
	// confirms, dated by when the institution reports them (A133).
	UnconfirmedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error)
	// LinePayees returns the payee classification decides for each line, uuid.Nil for none,
	// in input order (A99).
	LinePayees(ctx context.Context, booksID int64, lines []Line) ([]uuid.UUID, error)
	// RecordImported creates the transactions of the lines, ids in input order; a refused
	// line is a *RejectedLine and creates none.
	RecordImported(ctx context.Context, booksID int64, lines []NewLine) ([]uuid.UUID, error)
	// ConfirmLine corrects the transaction to the line's amount and date (A101); a voided
	// transaction is ErrTransactionVoided and a reconciled posting ErrReconciled.
	ConfirmLine(ctx context.Context, booksID int64, txID, accountID uuid.UUID, amount int64, date time.Time) error
	// GroupableTransactions returns the transactions among txIDs that a group may take over (A167).
	GroupableTransactions(ctx context.Context, booksID int64, txIDs []uuid.UUID) ([]uuid.UUID, error)
	// ConfirmGroup confirms the entry by the lines of a group (A169); ErrGroupChanged when the
	// entry cannot take one.
	ConfirmGroup(ctx context.Context, booksID int64, txID, accountID uuid.UUID, parts []GroupPart) error
	// MoveReconciledDate moves a transaction with a reconciled card posting to the line's date
	// when every reconciled posting keeps its statement (A147); else ErrReconciled.
	MoveReconciledDate(ctx context.Context, booksID int64, txID, accountID uuid.UUID, date time.Time) error
	// ClearMatched links the matches and returns the indexes of those whose transaction
	// already carries another record.
	ClearMatched(ctx context.Context, booksID int64, ms []Match) (conflicts []int, err error)
	AssertBalance(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedBalance records an aggregator balance without yield (P6 A42); a refused
	// assertion wraps ErrBalanceRejected.
	AssertSyncedBalance(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedReserve is AssertSyncedBalance for a reserved balance, which books bounded
	// yield on a positive difference (A75).
	AssertSyncedReserve(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// UpdateImportedPosting applies a later report on a recorded line (A36) and reports
	// whether the posting changed. A reconciled posting that already holds the reported
	// status and bill is (false, nil) (A147); one that does not is ErrReconciled. kind
	// KindPayment retypes a card credit as a payment; ErrNotRetypable when the transaction
	// changed since its import. ErrNotFound when no posting carries the record.
	UpdateImportedPosting(ctx context.Context, booksID int64, recordID uuid.UUID, pending bool, dueDate *time.Time, kind string) (bool, error)
	// RecordStatementFacts records a card bill on the ledger statement due on its due date (A85).
	RecordStatementFacts(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// RecordCardOpening opens a card that has no opening balance with the total of the bill
	// before its first synced cycle, billed on that bill's statement (A93).
	RecordCardOpening(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// SettleReportedStatements moves pending card postings off reported statements and
	// reconciles the reported statements that match (A90, A92).
	SettleReportedStatements(ctx context.Context, booksID int64, accountID uuid.UUID) error
	// ReleaseRecord unlinks a withdrawn record from its posting (A38).
	ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error
	// RecordInstallment creates the installment purchase of the first line seen of it and
	// returns its transaction and plan (A40); a refused line wraps ErrInstallmentRefused.
	RecordInstallment(ctx context.Context, booksID int64, l InstallmentLine) (txID, planID uuid.UUID, err error)
	// LinkInstallment links a line to installment number of a plan and returns its
	// transaction; ErrInstallmentRefused when the installment is gone, reversed, of another
	// amount or confirmed by another line.
	LinkInstallment(ctx context.Context, booksID int64, recordID, planID uuid.UUID, number int, l Line) (uuid.UUID, error)
	// RuleDecided reports, per line in input order, whether a rule of the owner decides its
	// category (A216 rule 1.4).
	RuleDecided(ctx context.Context, booksID int64, lines []Line) ([]bool, error)
	// Counterparts lists the transactions of rule 2 of A216 for the line, by date then id.
	Counterparts(ctx context.Context, booksID int64, l Line) ([]Counterpart, error)
	// PairLine makes txID the transfer of the record's line on accountID and returns the version
	// it gave the transaction (A218 rule 1); ErrNotPairable when the ledger refuses.
	PairLine(ctx context.Context, booksID int64, txID, accountID, recordID uuid.UUID) (int, error)
	// UnpairLine returns txID, paired at version, to its previous postings as a new version
	// (A220 rule 2); ErrNotUnpairable when it changed since or the ledger refuses.
	UnpairLine(ctx context.Context, booksID int64, txID, recordID uuid.UUID, version int) error
}

// Counterpart is a transaction a sync line may pair with (A216 rule 2): the posting of
// AccountID that RecordID confirms, and whether the transaction is a card payment (A88).
type Counterpart struct {
	TransactionID, AccountID, RecordID uuid.UUID
	CardPayment                        bool
}

// InstallmentLine is an aggregator card line that belongs to an installment purchase.
type InstallmentLine struct {
	RecordID    uuid.UUID
	Line        Line
	Installment domain.Installment
}
