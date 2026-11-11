package portfolio

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// TrailingReturn is the money-weighted return, in basis points, of the accounts taken as one tree
// over the last 12 months up to today, valued in in, with the whole months the window covers;
// ok is false when there is too little history or no flow (investments design 4.4).
func (m *Module) TrailingReturn(ctx context.Context, booksID int64, accountIDs []uuid.UUID, today time.Time, in money.Currency) (bp, months int, ok bool, err error) {
	return m.svc.TrailingReturn(ctx, booksID, accountIDs, today, in)
}

// ValuedBalances values each account's own balance at the end of date in the base currency;
// an account with a zero balance is absent. A missing price wraps ErrPriceMissing.
func (m *Module) ValuedBalances(ctx context.Context, booksID int64, date time.Time) (map[uuid.UUID]money.Money, error) {
	return m.svc.BaseValues(ctx, booksID, date)
}

func (m *Module) accountNames(ctx context.Context, booksID int64) (map[uuid.UUID]string, error) {
	accounts, _, err := m.ledger.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, err
	}

	names := make(map[uuid.UUID]string, len(accounts))
	for _, a := range accounts {
		names[a.ID] = a.Name
	}

	return names, nil
}
