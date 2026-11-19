package portfolio

import (
	"context"
	"encoding/json/v2"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/portfolio/postgres"
)

// RebuildAll recomputes every derived row from the ledger (equori portfolio rebuild).
func (m *Module) RebuildAll(ctx context.Context) error { return m.svc.RebuildAll(ctx) }

// RebuildForVersion runs RebuildAll once per app version, at the start of serve.
func (m *Module) RebuildForVersion(ctx context.Context, version string) error {
	return m.svc.RebuildForVersion(ctx, version)
}

// RebuildBooks recomputes the book's derived rows, after an import of an export archive.
func (m *Module) RebuildBooks(ctx context.Context, booksID int64) error {
	return m.svc.RebuildBooks(ctx, booksID)
}

// handle runs in the dispatcher's transaction, so the rebuilt rows commit with the delivery.
func (m *Module) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return m.svc.WithRepository(postgres.NewTxRepository(tx)).
		HandleTransaction(ctx, e.BooksID, payload.AccountIDs)
}
