package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// accountStore holds the Repository methods of accounts, institutions, payees and tags.
type accountStore interface {
	Settings(ctx context.Context, booksID int64) (Settings, error)
	SaveSettings(ctx context.Context, s Settings) error
	SetSystemAccountsInstrument(ctx context.Context, booksID int64, c money.Currency) error
	CountTransactions(ctx context.Context, booksID int64) (int64, error)

	InsertInstitution(ctx context.Context, i Institution) (Institution, error)
	SetInstitutionIdentifier(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		ident InstitutionIdentifier,
	) (Institution, error)
	// DeleteInstitution returns ErrNotFound for a missing institution and ErrInstitutionInUse
	// while an open account refers to it; a closed account loses its institution.
	DeleteInstitution(ctx context.Context, booksID int64, id uuid.UUID) error
	// List methods return the page and the key of its last row when more rows follow.
	ListInstitutions(
		ctx context.Context,
		booksID int64,
		p page.Request[InstitutionKey],
	) ([]Institution, *InstitutionKey, error)
	InsertPayee(ctx context.Context, p Payee) (Payee, error)
	Payee(ctx context.Context, booksID int64, id uuid.UUID) (Payee, error)
	ListPayees(
		ctx context.Context,
		booksID int64,
		p page.Request[PayeeKey],
	) ([]Payee, *PayeeKey, error)
	ListTags(ctx context.Context, booksID int64, p page.Request[TagKey]) ([]string, *TagKey, error)

	Account(ctx context.Context, booksID int64, id uuid.UUID) (domain.Account, error)
	Accounts(
		ctx context.Context,
		booksID int64,
		ids []uuid.UUID,
	) (map[uuid.UUID]domain.Account, error)
	ListAccounts(
		ctx context.Context,
		booksID int64,
		p page.Request[AccountKey],
	) ([]domain.Account, *AccountKey, error)
	InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	UpdateAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	AccountHasChildren(ctx context.Context, booksID int64, id uuid.UUID) (bool, error)
	// ChildAccounts returns the children of the account, oldest first.
	ChildAccounts(ctx context.Context, booksID int64, parentID uuid.UUID) ([]domain.Account, error)
	AccountTotals(ctx context.Context, booksID int64, id uuid.UUID) (AccountTotals, error)
	// TransactionsWithAccount returns the non-voided transactions with a posting on the account.
	TransactionsWithAccount(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) ([]uuid.UUID, error)
	// AccountTransactionsBetween returns the non-voided transactions with a posting on the
	// account dated in [from, to], by date.
	AccountTransactionsBetween(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]uuid.UUID, error)
	// RenamePayee returns ErrValidation on name for a name in use.
	RenamePayee(ctx context.Context, booksID int64, id uuid.UUID, name string) (Payee, error)
	// TransactionsWithPayee returns the non-voided transactions of the payee.
	TransactionsWithPayee(
		ctx context.Context,
		booksID int64,
		payeeID uuid.UUID,
	) ([]uuid.UUID, error)
	// RetirePayee moves the voided transactions and the counterparty accounts of from to into
	// and marks from as merged (A82).
	RetirePayee(ctx context.Context, booksID int64, from, into uuid.UUID) error
	// TagUsage returns ErrNotFound for a name the book has no tag under.
	TagUsage(ctx context.Context, booksID int64, name string) (TagUsage, error)
	// RenameTag returns ErrValidation on name for a name in use.
	RenameTag(ctx context.Context, booksID int64, id uuid.UUID, name string) error
	// TransactionsWithTag returns the non-voided transactions that carry the tag.
	TransactionsWithTag(ctx context.Context, booksID int64, tagID uuid.UUID) ([]uuid.UUID, error)
	// MoveTagLinks makes every transaction that carries from carry into as well.
	MoveTagLinks(ctx context.Context, booksID int64, from, into uuid.UUID) error
	// DeleteTag removes the tag from every transaction that still carries it.
	DeleteTag(ctx context.Context, booksID int64, id uuid.UUID) error
}
