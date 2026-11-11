package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
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
	Item(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) (domain.Connection, error)
	// Accounts lists the item's external accounts, reserved balances included.
	Accounts(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) ([]domain.ExternalAccount, error)
	// ItemState returns the item's status, last update and next automatic update.
	ItemState(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) (ItemState, error)
	// ReadAccount returns an account of the item with its lines dated in [from, to], in minor
	// units of scale; with createdFrom, also the lines the aggregator created at or after it,
	// in Created (A144). ErrAccountGone when the item no longer lists the account. A reserved
	// balance is found by its identification and read without lines (A74).
	ReadAccount(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID, accountID string, from, to time.Time, createdFrom *time.Time, scale int) (domain.AccountRead, error)
	Forget(integrationID uuid.UUID)
}

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

// Repository stores integrations and imports; postgres/ implements it.
// Repository returns ErrNotFound for missing rows.
type Repository interface {
	// MoveRecords points the linked records among recordIDs to the transaction.
	MoveRecords(ctx context.Context, booksID int64, recordIDs []uuid.UUID, transactionID uuid.UUID) error
	// CreatedRecords lists the account's records in state created dated in [from, to] (A167).
	CreatedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error)
	// GroupRecords lists the account's records in review reason group whose candidate is entry (A168).
	GroupRecords(ctx context.Context, booksID int64, accountID, entry uuid.UUID) ([]domain.ExternalRecord, error)
	ListBatches(ctx context.Context, booksID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error)
	Profile(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Profile, error)
	// SaveProfile returns ErrNotFound when the account does not belong to the book.
	SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error)
	// InsertBatch returns ErrNotFound when the account does not belong to the book.
	InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	// CompleteBatch stores the counts and the file balance and marks the batch complete.
	CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error)
	// ClaimRecords inserts the records in state received in one database transaction; a
	// record whose deduplication key exists comes back as stored, with Existed (I10).
	ClaimRecords(ctx context.Context, rs []domain.ExternalRecord) ([]Claim, error)
	// SaveOutcomes stores each record's batch, state, transaction and candidates in one
	// database transaction.
	SaveOutcomes(ctx context.Context, rs []domain.ExternalRecord) error
	Record(ctx context.Context, booksID int64, id uuid.UUID) (domain.ExternalRecord, error)
	Records(ctx context.Context, booksID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[RecordKey]) ([]domain.ExternalRecord, *RecordKey, error)
	// ResolveRecord stores a reviewed record and moves it out of its batch's needs_review count.
	ResolveRecord(ctx context.Context, r domain.ExternalRecord) error
	// ReopenRecord returns a discarded record to review; false when it is not discarded.
	ReopenRecord(ctx context.Context, booksID int64, id, batchID uuid.UUID) (bool, error)
	// SaveUndo stores, in one database transaction, a record after the undo of its decision
	// decided, moves an undone record that entered review out of the count of left, and inserts
	// line, when not nil, as a new record in review (A148). ErrNoDecision when the record no
	// longer carries decided.
	SaveUndo(ctx context.Context, rec domain.ExternalRecord, decided domain.DecisionKind, left domain.RecordState, line *domain.ExternalRecord) error
	// SyncRuns lists the newest sync runs of the connection whose summary lists a record, at
	// most limit, with their batches and those records (A149).
	SyncRuns(ctx context.Context, booksID int64, connectionID uuid.UUID, limit int) ([]domain.SyncRun, error)
	// LockAccountImports serializes the imports of one account until unlock runs.
	LockAccountImports(ctx context.Context, accountID uuid.UUID) (unlock func(), err error)

	// SyncInterval returns the stored interval; false without a row.
	SyncInterval(ctx context.Context) (int, bool, error)
	SetSyncInterval(ctx context.Context, minutes int) error

	// InsertIntegration returns a *domain.FieldError on name when the book already has the name.
	InsertIntegration(ctx context.Context, i domain.Integration) (domain.Integration, error)
	Integration(ctx context.Context, booksID int64, id uuid.UUID) (domain.Integration, error)
	ListIntegrations(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Integration, *NameKey, error)
	UpdateCredentials(ctx context.Context, booksID int64, id uuid.UUID, sealed []byte) (domain.Integration, error)
	// DeleteIntegration returns ErrIntegrationInUse while a connection uses the integration.
	DeleteIntegration(ctx context.Context, booksID int64, id uuid.UUID) error
	// StoredCredentials lists the book's integrations that hold a credential, by id.
	StoredCredentials(ctx context.Context, booksID int64) ([]domain.Integration, error)
	// ResealCredentials replaces, in one database transaction, every book's sealed
	// credentials for which reseal returns a value, and returns how many it replaced.
	ResealCredentials(ctx context.Context, reseal func(booksID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)
	// InsertConnection stores the connection and its accounts in one database transaction; a
	// *domain.FieldError on external_id when the integration already connects the item.
	InsertConnection(ctx context.Context, c domain.Connection) (domain.Connection, error)
	Connection(ctx context.Context, booksID int64, id uuid.UUID) (domain.Connection, error)
	ListConnections(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Connection, *NameKey, error)
	DeleteConnection(ctx context.Context, booksID int64, id uuid.UUID) error
	// LockBookPairing holds the book's pairing lock for one account batch of a sync (A218 rule 3).
	LockBookPairing(ctx context.Context, booksID int64) (unlock func(), err error)
	// TransferReviews lists the records of rule 3 of A216: in review transfer on an account other
	// than accountID, of amount in currency, dated in [from, to].
	TransferReviews(ctx context.Context, booksID int64, accountID uuid.UUID, amount int64, currency string, from, to time.Time) ([]domain.ExternalRecord, error)
	// RecordCounterparties returns the counterparty of each record that has one.
	RecordCounterparties(ctx context.Context, booksID int64, ids []uuid.UUID) (map[uuid.UUID]string, error)
	// BookHolders lists the holder digests of the book's mapped external accounts (A217).
	BookHolders(ctx context.Context, booksID int64) ([][]byte, error)
	// SetExternalAccountHolder stores the holder digest the item now reports (A217).
	SetExternalAccountHolder(ctx context.Context, booksID int64, id uuid.UUID, digest []byte) error
	// InsertMissingExternalAccount stores the external account, pending, unless the connection
	// already has one with its external id.
	InsertMissingExternalAccount(ctx context.Context, a domain.ExternalAccount) error
	// AccountFeed reports where the account's institution lines start and end (A103).
	AccountFeed(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Feed, error)
	// RenameExternalAccount stores the name the institution now reports for the external
	// account, keeps the previous one among its former names (A94) and dates the new one (A212).
	RenameExternalAccount(ctx context.Context, booksID int64, id uuid.UUID, name string, from *time.Time, on time.Time) error
	// SetExternalAccountGone stores the date a listing first lacked the account, or clears it
	// with nil (A214).
	SetExternalAccountGone(ctx context.Context, booksID int64, id uuid.UUID, since *time.Time) error
	// ReplaceMapping saves both mappings in one database transaction: released gives up the
	// ledger account that mapped takes (A214).
	ReplaceMapping(ctx context.Context, released, mapped domain.ExternalAccount) (domain.ExternalAccount, error)
	// OpenReserveReviews counts the connection's lines waiting because no reserve resolves them
	// (A213).
	OpenReserveReviews(ctx context.Context, booksID int64, connectionID uuid.UUID) (int64, error)
	// SaveMapping returns a *domain.FieldError on account_id when another external account
	// feeds the ledger account.
	SaveMapping(ctx context.Context, a domain.ExternalAccount) (domain.ExternalAccount, error)

	// UpdateRecordFacts stores what an aggregator now reports about stored records.
	UpdateRecordFacts(ctx context.Context, recs []domain.ExternalRecord) error
	// RepeatableRecords lists the account's created or matched records booked in [from, to];
	// with filesOnly, only those of file batches (A215).
	RepeatableRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time, filesOnly bool) ([]domain.ExternalRecord, error)
	// SyncedRecords lists the account's aggregator records booked in [from, to] that are
	// neither withdrawn nor discarded.
	SyncedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error)
	// RecordsByLineIDs lists the account's aggregator records whose external id or
	// institution line id is among the given ones (A143).
	RecordsByLineIDs(ctx context.Context, booksID int64, accountID uuid.UUID, externalIDs, institutionIDs []string) ([]domain.ExternalRecord, error)
	// Reidentify gives a record the external id, deduplication key and raw payload of a line,
	// as a decision of the batch's sync run (A143, A148).
	Reidentify(ctx context.Context, booksID int64, batchID, id uuid.UUID, externalID string, dedupKey []byte, raw map[string]string) error
	// WithdrawRecords marks records withdrawn by the batch's sync run, keeps what each was for
	// its undo, and takes them out of their batches' review counts (A38, A148).
	WithdrawRecords(ctx context.Context, booksID int64, batchID uuid.UUID, ids []uuid.UUID) error
	// MarkAccountSynced stores the account's last synced date and asserted balance.
	MarkAccountSynced(ctx context.Context, a domain.ExternalAccount) error
	// SaveConnectionState stores the connection's provider status, item update, last sync and error.
	SaveConnectionState(ctx context.Context, c domain.Connection) error
	// InstallmentPlans returns the ledger plans of the keys that have one, by key.
	InstallmentPlans(ctx context.Context, booksID int64, keys [][]byte) (map[string]uuid.UUID, error)
	SaveInstallmentPlan(ctx context.Context, booksID int64, accountID uuid.UUID, key []byte, planID uuid.UUID) error
	// AllConnections lists every book's connections, for the scheduler.
	AllConnections(ctx context.Context) ([]ConnectionRef, error)
}

// Admins tells whether a member holds the admin instance role.
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}
