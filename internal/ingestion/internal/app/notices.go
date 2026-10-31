package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// FeedState is a ledger account with the state of the connection that feeds it when that state
// is not ok, the institution's last update, and its unconfirmed entries (P12 A152).
type FeedState struct {
	ConnectionState string
	LastUpdate      *time.Time
	Unconfirmed     int
}

// FeedStates reads the feed of each given ledger account (A152).
func (s *Service) FeedStates(ctx context.Context, booksID int64, accountIDs []uuid.UUID) (map[uuid.UUID]FeedState, error) {
	states := make(map[uuid.UUID]FeedState, len(accountIDs))
	for _, id := range accountIDs {
		n, err := s.unconfirmedCount(ctx, booksID, id)
		if err != nil {
			return nil, err
		}

		states[id] = FeedState{Unconfirmed: n}
	}

	if s.available() != nil {
		return states, nil
	}

	var after *NameKey
	for {
		list, next, err := s.ListConnections(ctx, booksID, page.Request[NameKey]{After: after, Limit: page.MaxLimit})
		if err != nil {
			return nil, err
		}

		for _, c := range list {
			if c.State == domain.StateOK {
				continue
			}

			for _, a := range c.Accounts {
				if a.AccountID == nil {
					continue
				}

				if st, ok := states[*a.AccountID]; ok {
					st.ConnectionState, st.LastUpdate = string(c.State), c.LastItemUpdateAt
					states[*a.AccountID] = st
				}
			}
		}

		if next == nil {
			return states, nil
		}

		after = next
	}
}

func (s *Service) unconfirmedCount(ctx context.Context, booksID int64, accountID uuid.UUID) (int, error) {
	ps, _, err := s.Unconfirmed(ctx, booksID, accountID)

	var fe *domain.FieldError
	if errors.As(err, &fe) {
		return 0, nil
	}

	return len(ps), err
}
