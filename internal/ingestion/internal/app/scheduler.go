package app

import (
	"context"

	"github.com/google/uuid"
)

// SyncFailure is a connection a tick could not sync.
type SyncFailure struct {
	BooksID      int64
	ConnectionID uuid.UUID
	Err          error
}

// Tick syncs every book's connections whose item has data newer than their last sync (P6
// amendment A43). A failing connection does not stop the others.
func (s *Service) Tick(ctx context.Context) ([]SyncFailure, error) {
	if err := s.available(); err != nil {
		return nil, nil
	}

	refs, err := s.repo.AllConnections(ctx)
	if err != nil {
		return nil, err
	}

	var failures []SyncFailure
	for _, ref := range refs {
		if ctx.Err() != nil {
			return failures, ctx.Err()
		}

		bctx, err := s.inBooks(ctx, ref.BooksID)
		if err != nil {
			failures = append(failures, SyncFailure{BooksID: ref.BooksID, ConnectionID: ref.ID, Err: err})
			continue
		}

		if _, _, err := s.sync(bctx, ref.BooksID, ref.ID, false); err != nil {
			failures = append(failures, SyncFailure{BooksID: ref.BooksID, ConnectionID: ref.ID, Err: err})
		}
	}

	return failures, nil
}
