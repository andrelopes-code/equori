// Package reporting maintains read models derived from the ledger (chapter 4, 4.3.7).
package reporting

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/app"
	"github.com/andrelopes-code/equori/internal/reporting/httpapi"
	"github.com/andrelopes-code/equori/internal/reporting/postgres"
	"github.com/andrelopes-code/equori/internal/reporting/toolapi"
)

type Module struct {
	svc     *app.Service
	exports *app.Exports
	http    *httpapi.Server
	clk     clock.Clock
}

// appVersion is the version of the running app, written in each export manifest (ADR 021).
func New(
	pool *pgxpool.Pool,
	dispatcher *outbox.Dispatcher,
	clk clock.Clock,
	log *slog.Logger,
	appVersion string,
) *Module {
	svc := app.NewService(postgres.NewRepository(pool))
	store := postgres.NewExports(pool, appVersion)
	exports := app.NewExports(store, store, clk, svc.RebuildBooks)
	dispatcher.Subscribe(
		"reporting-export",
		postgres.EventExportRequested,
		func(ctx context.Context, _ pgx.Tx, e outbox.Delivered) error {
			var p struct {
				ExportID uuid.UUID `json:"export_id"`
			}
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return fmt.Errorf("decode %s: %w", e.Type, err)
			}

			return exports.Build(ctx, e.BooksID, p.ExportID)
		},
	)

	for _, eventType := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe("reporting-series", eventType, rebuildSeries)
	}

	return &Module{
		svc:     svc,
		exports: exports,
		http:    httpapi.NewServer(svc, exports, clk, log),
		clk:     clk,
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of an archive import: the largest archive plus
// the multipart framing (export design E5).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{
		{Pattern: "POST /api/v1/imports/archive", Bytes: app.MaxArchiveBytes + 1<<20},
	}
}

// Tools returns the reporting module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{
		Tools:  toolapi.Tools(m.svc, m.exports, m.clk),
		Errors: tool.FromProblem(httpapi.ToProblem),
	}
}

// RebuildAll recomputes every account's series from its first posting (equori reporting rebuild).
func (m *Module) RebuildAll(ctx context.Context) error { return m.svc.RebuildAll(ctx) }
