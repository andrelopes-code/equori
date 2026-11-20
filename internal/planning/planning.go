// Package planning expects money through schedules, occurrences, budgets and goals (docs/domain, 4.3.4).
// It is the only entry point to the module for the rest of the application.
package planning

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/httpapi"
	"github.com/andrelopes-code/equori/internal/planning/postgres"
	"github.com/andrelopes-code/equori/internal/planning/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	log    *slog.Logger
	ledger *ledger.Module
	clk    clock.Clock
}

func New(
	pool *pgxpool.Pool,
	dispatcher *outbox.Dispatcher,
	l *ledger.Module,
	md *marketdata.Module,
	profiles Profiles,
	returns app.Returns,
	clk clock.Clock,
	log *slog.Logger,
) *Module {
	svc := app.NewService(
		postgres.NewRepository(pool),
		ledgerPort{l},
		calendarPort{md},
		profiles,
		pricesPort{md},
		returns,
		clk,
	)
	m := &Module{http: httpapi.NewServer(svc, log), svc: svc, log: log, ledger: l, clk: clk}
	// P7 amendment A51: every change of a transaction can change the occurrence it realizes.
	for _, t := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, t, m.handle)
	}

	dispatcher.Subscribe(consumer, ledger.EventCategoriesMerged, m.handleMerge)
	dispatcher.Subscribe(consumer, ledger.EventPayeesMerged, m.handlePayeeMerge)

	return m
}

// Views returns the builders of the views of the module's reads (answer views design, V3).
func (m *Module) Views() map[view.Key]view.Builder { return toolapi.Views() }

// Tools returns the planning module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{
		Tools:  toolapi.Tools(m.svc, toolLedger{m.ledger}, m.clk),
		Errors: tool.FromProblem(httpapi.ToProblem),
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// CommittedTotal is the committed amount of month (A57), in the base currency.
func (m *Module) CommittedTotal(
	ctx context.Context,
	booksID int64,
	month time.Time,
) (money.Money, error) {
	c, err := m.svc.Committed(ctx, booksID, month)
	if err != nil {
		return money.Money{}, err
	}

	return money.New(c.Total, c.Currency)
}

// Tick extends the occurrences of every schedule to the horizon (P7 amendment A53) and logs
// each failure by schedule id.
func (m *Module) Tick(ctx context.Context) {
	failures, err := m.svc.Tick(ctx)
	if err != nil {
		m.log.ErrorContext(ctx, "planning tick", "error", err)
		return
	}

	for _, f := range failures {
		m.log.ErrorContext(ctx, "extend schedule", "schedule_id", f.Ref.ID, "error", f.Err)
	}
}

// Backfill generates the occurrences every schedule lacks before its first generated one, as
// creation does since P7 amendment A127; a second run changes nothing.
func (m *Module) Backfill(ctx context.Context) error {
	return m.svc.Backfill(ctx)
}

// RunScheduler ticks now and then every interval until ctx ends.
func (m *Module) RunScheduler(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()

	for {
		m.Tick(ctx)

		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
