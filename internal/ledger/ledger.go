// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
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
	http *httpapi.Server
}

// Calendar is the part of marketdata the ledger uses to shift due dates.
type Calendar interface {
	Adjust(ctx context.Context, name string, d time.Time, a marketdata.Adjustment) (time.Time, error)
}

type calendarAdapter struct{ cal Calendar }

func (c calendarAdapter) Adjust(ctx context.Context, name string, d time.Time, adjustment string) (time.Time, error) {
	return c.cal.Adjust(ctx, name, d, marketdata.Adjustment(adjustment))
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, cal Calendar, clk clock.Clock, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), clk, calendarAdapter{cal})
	dispatcher.Subscribe("ledger-provisioning", "identity.user_created.v1", provision)
	return &Module{http: httpapi.NewServer(svc, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

type userCreated struct {
	UserID int64 `json:"user_id"`
}

// provision runs in the dispatcher's transaction, so the system accounts commit with the delivery.
func provision(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p userCreated
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	svc := app.NewService(postgres.NewRepository(tx), clock.New(time.UTC, time.Now), nil)
	return svc.Provision(ctx, p.UserID, DefaultBaseCurrency)
}
