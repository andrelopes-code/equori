// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/postgres"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

type booksCreated struct {
	BooksID      int64          `json:"books_id"`
	BaseCurrency money.Currency `json:"base_currency"`
}

// settleCards settles the reported statements of each card a transaction event names (A139).
func settleCards(svc *app.Service) outbox.Handler {
	return func(ctx context.Context, _ pgx.Tx, e outbox.Delivered) error {
		var p app.TransactionEvent
		if err := json.Unmarshal(e.Payload, &p); err != nil {
			return fmt.Errorf("decode %s: %w", e.Type, err)
		}

		return svc.SettleChangedCards(ctx, e.BooksID, p.AccountIDs)
	}
}

// provision runs in the dispatcher's transaction, so the system accounts commit with the delivery.
func provision(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p booksCreated
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}

	svc := app.NewService(postgres.NewRepository(tx, nil), clock.New(time.Now), nil, nil, nil, nil, nil)

	return svc.Provision(ctx, p.BooksID, p.BaseCurrency)
}
