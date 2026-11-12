package planning

import (
	"context"
	"encoding/json/v2"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/postgres"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "planning"

// handle runs in the dispatcher's transaction, so the realization commits with the delivery.
func (m *Module) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return m.svc.WithRepository(postgres.NewTxRepository(tx)).
		HandleTransaction(ctx, app.TransactionChanged{
			BooksID:       e.BooksID,
			TransactionID: payload.TransactionID,
			AccountIDs:    payload.AccountIDs,
		})
}

// handleMerge follows a category merge in the dispatcher's transaction (A75).
func (m *Module) handleMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.CategoriesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return m.svc.WithRepository(postgres.NewTxRepository(tx)).
		HandleCategoriesMerged(ctx, e.BooksID, payload.From, payload.Into)
}

// handlePayeeMerge follows a payee merge in the dispatcher's transaction (A82).
func (m *Module) handlePayeeMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.PayeesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return m.svc.WithRepository(postgres.NewTxRepository(tx)).
		HandlePayeesMerged(ctx, e.BooksID, payload.From, payload.Into)
}
