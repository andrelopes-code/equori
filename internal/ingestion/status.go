package ingestion

import (
	"context"

	"github.com/google/uuid"
)

// FeedStates reads the feed of each given ledger account (P12 A152).
func (m *Module) FeedStates(ctx context.Context, booksID int64, accountIDs []uuid.UUID) (map[uuid.UUID]FeedState, error) {
	return m.svc.FeedStates(ctx, booksID, accountIDs)
}

// ConnectionDiagnostics lists every book's connections for the diagnostic file (P13 A158).
func (m *Module) ConnectionDiagnostics(ctx context.Context) ([]ConnectionDiagnostic, error) {
	return m.svc.ConnectionDiagnostics(ctx)
}
