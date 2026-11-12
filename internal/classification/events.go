package classification

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/postgres"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "classification"

// eventTypes maps the ledger events Classification reacts to (F5, P5 amendment A20).
var eventTypes = map[string]string{
	ledger.EventTransactionRecorded:    app.EventRecorded,
	ledger.EventTransactionCorrected:   app.EventCorrected,
	ledger.EventTransactionCategorized: app.EventCategorized,
	ledger.EventTransactionVoided:      app.EventVoided,
}

// handleMerge follows a category merge in the dispatcher's transaction (A75).
func (p ledgerPort) handleMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.CategoriesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return app.NewService(postgres.NewTxRepository(tx), p).
		HandleCategoriesMerged(ctx, e.BooksID, payload.From, payload.Into)
}

// handlePayeeMerge follows a payee merge in the dispatcher's transaction (A82).
func (p ledgerPort) handlePayeeMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.PayeesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return app.NewService(postgres.NewTxRepository(tx), p).
		HandlePayeesMerged(ctx, e.BooksID, payload.From, payload.Into)
}

// handleTagRename follows a tag rename or merge in the dispatcher's transaction.
func (p ledgerPort) handleTagRename(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TagRenamed
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	return app.NewService(postgres.NewTxRepository(tx), p).
		HandleTagRenamed(ctx, e.BooksID, payload.From, payload.Into)
}

// handle runs in the dispatcher's transaction, so the record commits with the delivery.
func (p ledgerPort) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	date, err := time.Parse(time.DateOnly, payload.Date)
	if err != nil {
		return fmt.Errorf("%s date: %w", e.Type, err)
	}

	event := app.Event{
		Type:              eventTypes[e.Type],
		BooksID:           e.BooksID,
		TransactionID:     payload.TransactionID,
		Version:           payload.Version,
		Date:              date,
		Origin:            payload.Origin,
		CategoryState:     payload.CategoryState,
		CategoriesChanged: payload.CategoriesChanged,
		OccurredAt:        e.OccurredAt,
	}
	if payload.Cause != nil {
		event.Cause = app.Cause{Method: payload.Cause.Method, RuleID: payload.Cause.RuleID}
	}

	return app.NewService(postgres.NewTxRepository(tx), p).HandleEvent(ctx, event)
}
