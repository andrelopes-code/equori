package planning

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// Profiles is the part of identity the module uses to default a schedule's calendar.
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
	// InBooks returns ctx with the book as the active book and its location (BK20).
	InBooks(ctx context.Context, booksID int64) (context.Context, error)
}

// RecurringProbe is a transaction not recorded yet, named as a preview names it.
type RecurringProbe struct {
	Payee, Description, Account string
	Date                        time.Time
	Amount                      string // decimal text of the preview
	Currency                    string
}
