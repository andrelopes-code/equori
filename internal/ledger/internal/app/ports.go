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
)

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

	// BalanceAt sums the postings of the account and its descendants up to and including date.
	BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (int64, error)
}
