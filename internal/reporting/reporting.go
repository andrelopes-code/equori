// Package reporting maintains read models derived from the ledger (chapter 4, 4.3.7).
package reporting

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/reporting/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

type Module struct {
	svc     *app.Service
	exports *app.Exports
	http    *httpapi.Server
	clk     clock.Clock
}

// appVersion is the version of the running app, written in each export manifest (ADR 021).
func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, clk clock.Clock, log *slog.Logger, appVersion string) *Module {
	svc := app.NewService(postgres.NewRepository(pool))
	store := postgres.NewExports(pool, appVersion)
	exports := app.NewExports(store, store, clk, svc.RebuildUser)
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
	return &Module{svc: svc, exports: exports, http: httpapi.NewServer(svc, exports, clk, log), clk: clk}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// OnImport adds the rebuild of another module's derived tables, run for the user after an
// import of an export archive (export design E4).
func (m *Module) OnImport(rebuild func(ctx context.Context, userID int64) error) {
	m.exports.OnImport(rebuild)
}

// BodyLimits raises the request body limit of an archive import: the largest archive plus
// the multipart framing (export design E5).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/imports/archive", Bytes: app.MaxArchiveBytes + 1<<20}}
}

// Tools returns the reporting module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc, m.clk), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// Commitments is the committed amount of a month, lent by planning.
type Commitments interface {
	CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error)
}

// Valuations values each account's own balance at the end of a date in the base currency, lent by portfolio.
type Valuations interface {
	ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error)
}

// UseIndicatorSources lends the indicators their two sources; internal/server binds them late
// because planning and portfolio are built after reporting.
func (m *Module) UseIndicatorSources(c Commitments, v Valuations) {
	m.svc.UseIndicatorSources(priced{c, v}, priced{c, v})
}

// priced turns a missing price of either source into app.ErrPriceMissing, so the operation
// answers price_missing.
type priced struct {
	c Commitments
	v Valuations
}

func (p priced) CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error) {
	c, err := p.c.CommittedTotal(ctx, userID, month)
	return c, priceMissing(err)
}

func (p priced) ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error) {
	v, err := p.v.ValuedBalances(ctx, userID, date)
	return v, priceMissing(err)
}

func priceMissing(err error) error {
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}
	return err
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
