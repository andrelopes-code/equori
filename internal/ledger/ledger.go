// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// DefaultBaseCurrency is the base currency of a new user; it can change until the first transaction.
const DefaultBaseCurrency = "BRL"

// Event types published by the ledger (ADR 006).
const (
	EventTransactionRecorded  = app.EventTransactionRecorded
	EventTransactionCorrected = app.EventTransactionCorrected
	EventTransactionVoided    = app.EventTransactionVoided
)

// TransactionEvent is the payload of the transaction events.
type TransactionEvent = app.TransactionEvent

type Module struct {
	svc *app.Service
	log *slog.Logger
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, log *slog.Logger) *Module {
	m := &Module{svc: app.NewService(postgres.NewRepository(pool), time.Now), log: log}
	dispatcher.Subscribe("ledger-provisioning", "identity.user_created.v1", provision)
	return m
}

type userCreated struct {
	UserID int64 `json:"user_id"`
}

// provision runs in the dispatcher's transaction, so the system accounts commit with the delivery.
func provision(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p userCreated
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	svc := app.NewService(postgres.NewRepository(tx), time.Now)
	return svc.Provision(ctx, p.UserID, DefaultBaseCurrency)
}
