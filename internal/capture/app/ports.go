package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Ledger is what the capture reads from the ledger.
type Ledger interface {
	Vocabulary(ctx context.Context, booksID int64) ([]Account, []Payee, error)
	BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error)
	// Transactions returns the book's transactions among ids in the order of ids; unknown ids
	// are omitted.
	Transactions(ctx context.Context, booksID int64, ids []uuid.UUID) ([]Transaction, error)
	Today(ctx context.Context) time.Time
}

// Classifier decides the category of entries; the module root adapts the classification module to it.
type Classifier interface {
	Decide(ctx context.Context, booksID int64, entries []Entry) ([]Decision, error)
}

// Profiles supplies the language and region a book's lines are read in.
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// Suggester names, per item, the index of one option or −1 for none.
type Suggester interface {
	Suggest(ctx context.Context, l locale.Locale, options []CategoryOption, items []SuggestItem) ([]int, error)
}

// HintRepository stores the hints of past descriptions; postgres/ implements it.
type HintRepository interface {
	Hints(ctx context.Context, booksID int64, descriptions []string) ([]Hint, error)
	SaveHint(ctx context.Context, booksID int64, h Hint) error
}
