package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// CashRepository reads the cash facts of a book; postgres/ implements it.
type CashRepository interface {
	CardFacts(ctx context.Context, booksID int64, to time.Time) (CardFacts, error)
	// OffCardTotals sums, per category, the postings in [from, to] of transactions without a card line.
	OffCardTotals(ctx context.Context, booksID int64, from, to time.Time) (Shares, error)
}

// ExportRepository stores export requests and reads the tables to export; postgres/ implements it.
type ExportRepository interface {
	// RequestExport replaces a finished export with a pending one and publishes
	// EventExportRequested in the same transaction; ok is false while one is pending.
	// credentials is the sealed bundle of export design C2, nil for none.
	RequestExport(
		ctx context.Context,
		booksID int64,
		at time.Time,
		credentials []byte,
	) (e Export, ok bool, err error)
	Export(ctx context.Context, booksID int64) (Export, error)
	ExportContent(ctx context.Context, booksID int64) (Export, []byte, error)
	// BuildArchive reads every fact of the book from one snapshot (export design E1, E2).
	BuildArchive(ctx context.Context, booksID int64, at time.Time) ([]byte, error)
	FinishExport(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		at time.Time,
		archive []byte,
		problem string,
	) error
}

// Credentials is lent by internal/server: the integration credentials and the provider keys of a
// book, sealed by a passphrase for the archive and sealed again for the instance that imports it
// (export design C2, C6, T3, T5).
type Credentials interface {
	// Bundle seals the secrets of the book under passphrase; nil when it stores none.
	// ErrCredentialsUnavailable without the instance key.
	Bundle(ctx context.Context, booksID int64, passphrase string) ([]byte, error)
	// Reseal opens bundle with passphrase and returns each secret sealed for booksID under the
	// key of this instance. ErrPassphraseInvalid for a wrong passphrase or a tampered bundle;
	// ErrCredentialsUnavailable without the instance key.
	Reseal(booksID int64, passphrase string, bundle []byte) (SealedCredentials, error)
}

// FlowRepository reads the flows of one account, without its sub-accounts.
type FlowRepository interface {
	AccountInstrument(ctx context.Context, booksID int64, accountID uuid.UUID) (string, error)
	AccountFlows(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]Flow, error)
}

// ImportRepository writes the tables of an archive; postgres/ implements it.
type ImportRepository interface {
	// ImportableTables are the tables an archive may carry on this instance.
	ImportableTables(ctx context.Context) ([]string, error)
	// Import writes the tables in one transaction (export design E4, steps 2 to 4);
	// attachments are keyed by the hexadecimal SHA-256 of their bytes. sealed holds the secret of
	// each integration and of each provider by id; the transaction writes those of the imported
	// rows and returns their counts (export design C6, T5). A non-empty replace is the book name
	// that lets the import delete the content of a book that holds facts (export design R2).
	Import(
		ctx context.Context,
		booksID int64,
		tables []ArchiveTable,
		attachments map[string][]byte,
		sealed SealedCredentials,
		replace string,
	) ([]TableCount, RestoredCredentials, error)
}

// Commitments is the committed amount of a month (planning, A57).
type Commitments interface {
	CommittedTotal(ctx context.Context, booksID int64, month time.Time) (money.Money, error)
}

// Valuations values each account's own balance at the end of a date in the base currency.
type Valuations interface {
	ValuedBalances(
		ctx context.Context,
		booksID int64,
		date time.Time,
	) (map[uuid.UUID]money.Money, error)
}

// IndicatorRepository reads the facts behind the indicators; postgres/ implements it.
type IndicatorRepository interface {
	BaseCurrency(ctx context.Context, booksID int64) (string, error)
	// FirstPosting is the earliest booked date of the book's postings that are not voided; ok is false without one.
	FirstPosting(ctx context.Context, booksID int64) (first time.Time, ok bool, err error)
	IndicatorAccounts(ctx context.Context, booksID int64) ([]IndicatorAccount, error)
	// OffCardMonthTotals is OffCardTotals per month, keyed by the first day of the month.
	OffCardMonthTotals(
		ctx context.Context,
		booksID int64,
		from, to time.Time,
	) (map[time.Time]Shares, error)
	LoanPrincipalByMonth(
		ctx context.Context,
		booksID int64,
		from, to time.Time,
	) (map[time.Time]int64, error)
}

// Repository reads Ledger tables only through SELECT (ADR 002).
type Repository interface {
	FlowRepository
	CashRepository
	AnalyticsRepository
	IndicatorRepository
	AccountCurrency(ctx context.Context, booksID int64, accountID uuid.UUID) (string, error)
	AccountName(ctx context.Context, booksID int64, accountID uuid.UUID) (string, error)
	Rebuild(ctx context.Context, booksID int64, accountID uuid.UUID, from time.Time) error
	TreeDailyDeltas(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		to time.Time,
	) ([]DayDelta, error)
	AllAccounts(ctx context.Context) ([]AccountRef, error)
	// CategoryTotals returns every account of the class with its own booked total in [from, to].
	CategoryTotals(
		ctx context.Context,
		booksID int64,
		class string,
		from, to time.Time,
	) ([]CategoryRow, error)
}

// AnalyticsRepository reads the statements and facts of cards; postgres/ implements it.
type AnalyticsRepository interface {
	StatementCard(ctx context.Context, booksID int64, id uuid.UUID) (uuid.UUID, error)
	// CardStatements returns the card's instrument and statements, newest first.
	CardStatements(
		ctx context.Context,
		booksID int64,
		cardID uuid.UUID,
	) (string, []StatementRef, error)
	ChargeCategories(ctx context.Context, booksID int64) (map[uuid.UUID]bool, error)
}
