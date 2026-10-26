// Package reporting maintains read models derived from the ledger (chapter 4, 4.3.7).
package reporting

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, clk clock.Clock, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool))
	exports := app.NewExports(postgres.NewExports(pool), clk)
	dispatcher.Subscribe("reporting-export", postgres.EventExportRequested, func(ctx context.Context, _ pgx.Tx, e outbox.Delivered) error {
		var p struct {
			ExportID uuid.UUID `json:"export_id"`
		}
		if err := json.Unmarshal(e.Payload, &p); err != nil {
			return fmt.Errorf("decode %s: %w", e.Type, err)
		}
		return exports.Build(ctx, e.UserID, p.ExportID)
	})
	for _, eventType := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe("reporting-series", eventType, rebuildSeries)
	}
	return &Module{svc: svc, http: httpapi.NewServer(svc, exports, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// Tools returns the reporting module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// RebuildAll recomputes every account's series from its first posting (equori reporting rebuild).
func (m *Module) RebuildAll(ctx context.Context) error { return m.svc.RebuildAll(ctx) }

// rebuildSeries runs in the dispatcher's transaction: the series commits with the delivery.
func rebuildSeries(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var p ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &p); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	from, err := time.Parse(time.DateOnly, p.Date)
	if err != nil {
		return fmt.Errorf("%s date: %w", e.Type, err)
	}
	if p.PreviousDate != "" {
		prev, err := time.Parse(time.DateOnly, p.PreviousDate)
		if err != nil {
			return fmt.Errorf("%s previous_date: %w", e.Type, err)
		}
		if prev.Before(from) {
			from = prev
		}
	}
	return app.NewService(postgres.NewRepository(tx)).RebuildAccounts(ctx, e.UserID, p.AccountIDs, from)
}
