// Package classification decides categories with rules, payee aliases and payee history (docs/domain, 4.3.2).
// It is the only entry point to the module for the rest of the application.
package classification

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/classification/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger"
)

type Module struct {
	http *httpapi.Server
	svc  *app.Service
}

func New(pool *pgxpool.Pool, l *ledger.Module, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l})
	return &Module{http: httpapi.NewServer(svc, log), svc: svc}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, userID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, userID)
	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{
			ID: a.ID, Class: a.Class, Kind: a.Kind, SystemRole: a.SystemRole,
			Instrument: a.Instrument, OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		}
	}
	return out, err
}

func (p ledgerPort) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, userID, ids)
}
