package identity

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// Profile returns the language and region of the books; the member is the context's, or 0 without one.
func (m *Module) Profile(ctx context.Context, booksID int64) (locale.Locale, error) {
	memberID, _ := auth.MemberID(ctx)

	return m.svc.Profile(ctx, booksID, memberID)
}

// InBooks returns ctx with booksID as the active book and the book's location (BK19, BK20).
func (m *Module) InBooks(ctx context.Context, booksID int64) (context.Context, error) {
	loc, err := m.svc.Location(ctx, booksID)
	if err != nil {
		return nil, err
	}

	return clock.WithLocation(auth.WithBooksID(ctx, booksID), loc), nil
}

// Location returns the book's time_zone, or DefaultTimeZone of its region while null.
func (m *Module) Location(ctx context.Context, booksID int64) (*time.Location, error) {
	return m.svc.Location(ctx, booksID)
}
