package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// importStore holds the Repository methods of external records and imported postings.
type importStore interface {
	// TransactionByExternalRecord returns ErrNotFound when no transaction carries the record.
	TransactionByExternalRecord(
		ctx context.Context,
		booksID int64,
		recordID uuid.UUID,
	) (uuid.UUID, error)
	// TransactionsByExternalRecords maps each record id that a transaction carries to it.
	TransactionsByExternalRecords(
		ctx context.Context,
		booksID int64,
		recordIDs []uuid.UUID,
	) (map[uuid.UUID]uuid.UUID, error)
	// LockAccountPostingLinks locks the transaction and its postings on the account and
	// returns them in position order.
	LockAccountPostingLinks(
		ctx context.Context,
		booksID int64,
		txID, accountID uuid.UUID,
	) ([]PostingLink, error)
	UnlinkedPostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]UnlinkedPosting, error)
	UnconfirmedPostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]UnlinkedPosting, error)
	// LinkExternalRecord returns ErrAlreadyMatched when another posting carries the record.
	LinkExternalRecord(ctx context.Context, booksID int64, postingID, recordID uuid.UUID) error
	ClearPendingPostings(ctx context.Context, booksID int64, txID, accountID uuid.UUID) error
	// LockImportedPosting returns the posting an external record confirms; ErrNotFound when none.
	LockImportedPosting(
		ctx context.Context,
		booksID int64,
		recordID uuid.UUID,
	) (ImportedPostingState, error)
	// SettleImportedPosting sets the posting's status and, when statementID is not nil, its statement.
	SettleImportedPosting(
		ctx context.Context,
		booksID int64,
		postingID uuid.UUID,
		status domain.PostingStatus,
		statementID uuid.UUID,
	) error
	ReleaseExternalRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error
	// RecordPosting returns the transaction and the installment plan of the posting an
	// external record confirms; ErrNotFound when none.
	RecordPosting(
		ctx context.Context,
		booksID int64,
		recordID uuid.UUID,
	) (txID, planID uuid.UUID, err error)
	// LockPlanInstallment returns installment number of the plan; ErrNotFound when none.
	LockPlanInstallment(
		ctx context.Context,
		booksID int64,
		planID uuid.UUID,
		number int,
	) (PlanInstallmentState, error)
	// StatementByDueDate returns the card statement due on the date; ErrNotFound when none.
	StatementByDueDate(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		due time.Time,
	) (domain.ReferenceMonth, error)
	// PairingCandidates returns the ids that pair with a transfer, by date then id (P5b amendment A29).
	PairingCandidates(ctx context.Context, q PairingQuery) ([]uuid.UUID, error)
	// ImportCounterparts returns the rows of ImportCounterparts for amount, the opposite of the line.
	ImportCounterparts(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		currency money.Currency,
		amount int64,
		from, to time.Time,
	) ([]Counterpart, error)
	// ClearRecordLinks removes the record links of a transaction's postings.
	ClearRecordLinks(ctx context.Context, booksID int64, txID uuid.UUID) error
}
