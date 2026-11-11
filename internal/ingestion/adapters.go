package ingestion

import (
	"context"
	"encoding/json/v2"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/postgres"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

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

// followPairing runs in the dispatcher's transaction, so the records move with the delivery.
func followPairing(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p ledger.PairedEvent
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return app.NewService(postgres.NewTxRepository(tx), nil, app.Integrations{}).FollowPairing(ctx, e.BooksID, p.Kept, p.RecordIDs)
}
