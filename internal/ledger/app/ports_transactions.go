package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// transactionStore holds the Repository methods of transactions and their attachments.
type transactionStore interface {
	Transaction(ctx context.Context, booksID int64, id uuid.UUID) (domain.Transaction, error)
	LockTransaction(ctx context.Context, booksID int64, id uuid.UUID) (domain.Transaction, error)
	InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error)
	// InsertTransactionRows writes a validated, billed transaction without reading it back.
	InsertTransactionRows(ctx context.Context, t domain.Transaction) error
	ReplaceTransaction(ctx context.Context, prev, next domain.Transaction, reason string) error
	// ReplaceReconciledTransaction is ReplaceTransaction with the I05 trigger bypassed for the
	// current database transaction (A147 rule 3).
	ReplaceReconciledTransaction(
		ctx context.Context,
		prev, next domain.Transaction,
		reason string,
	) error
	// ReplaceCategoryPostings stores next, which differs from prev only in its category
	// postings, description, payee, tags and version; other postings keep their rows.
	ReplaceCategoryPostings(ctx context.Context, prev, next domain.Transaction, reason string) error
	TransactionsByIDs(
		ctx context.Context,
		booksID int64,
		ids []uuid.UUID,
	) ([]domain.Transaction, error)
	// RawDescriptions returns the version 1 description of the given transactions that have later versions.
	RawDescriptions(
		ctx context.Context,
		booksID int64,
		ids []uuid.UUID,
	) (map[uuid.UUID]string, error)
	AllAccounts(ctx context.Context, booksID int64) ([]domain.Account, error)
	ExistingPayees(
		ctx context.Context,
		booksID int64,
		ids []uuid.UUID,
	) (map[uuid.UUID]struct{}, error)
	// PayeeNames omits identifiers of other books and unknown identifiers.
	PayeeNames(ctx context.Context, booksID int64, ids []uuid.UUID) (map[uuid.UUID]string, error)
	LatestPayeeCategories(
		ctx context.Context,
		booksID int64,
		payees []uuid.UUID,
	) (map[PayeeClass]uuid.UUID, error)
	VoidTransaction(ctx context.Context, t domain.Transaction) error
	ListTransactions(ctx context.Context, q TransactionQuery) ([]domain.Transaction, error)
	Versions(ctx context.Context, booksID int64, id uuid.UUID) ([]Version, error)

	// InsertAttachment stores the content unless the book already has a blob with the same hash.
	InsertAttachment(ctx context.Context, a Attachment, content []byte) (Attachment, error)
	Attachments(
		ctx context.Context,
		booksID int64,
		transactionID uuid.UUID,
		p page.Request[AttachmentKey],
	) ([]Attachment, *AttachmentKey, error)
	AttachmentContent(ctx context.Context, booksID int64, id uuid.UUID) (AttachmentContent, error)
	// DeleteAttachment deletes the blob too when no other attachment references it.
	DeleteAttachment(ctx context.Context, booksID int64, id uuid.UUID) error
}
