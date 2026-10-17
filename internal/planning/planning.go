// Package planning expects money through schedules, occurrences, budgets and goals (docs/domain, 4.3.4).
// It is the only entry point to the module for the rest of the application.
package planning

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

type Module struct {
	http *httpapi.Server
	svc  *app.Service
	log  *slog.Logger
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, md *marketdata.Module, clk clock.Clock, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l}, calendarPort{md}, clk)
	return &Module{http: httpapi.NewServer(svc, log), svc: svc, log: log}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

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

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, userID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, userID)
	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{ID: a.ID, Class: a.Class, Kind: a.Kind, Instrument: a.Instrument}
	}
	return out, err
}

func (p ledgerPort) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, userID, ids)
}

func (p ledgerPort) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, userID)
}

type calendarPort struct{ md *marketdata.Module }

func (c calendarPort) Holidays(ctx context.Context, name string, year int) ([]time.Time, error) {
	hs, err := c.md.Holidays(ctx, name, year)
	out := make([]time.Time, len(hs))
	for i, h := range hs {
		out[i] = h.Date
	}
	return out, err
}
