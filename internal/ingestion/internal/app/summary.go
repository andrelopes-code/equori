package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// SyncRuns lists the last sync runs of a connection that decided, created or placed a line in
// review, newest first (A149); ErrNotFound when the book has no such connection.
func (s *Service) SyncRuns(ctx context.Context, booksID int64, connectionID uuid.UUID) ([]domain.SyncRun, error) {
	if _, err := s.repo.Connection(ctx, booksID, connectionID); err != nil {
		return nil, err
	}

	return s.repo.SyncRuns(ctx, booksID, connectionID, domain.SyncRunsListed)
}
