// Package server composes the modules into the HTTP handler and the outbox
// dispatcher. cmd/equori and internal/apitest build the application through it.
package server

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/reporting"
)

type Config struct {
	SecureCookies bool
}

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	Identity   *identity.Module
	Reporting  *reporting.Module
}

// New registers every module's routes and outbox subscriptions; the caller runs Dispatcher.
func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) *App {
	dispatcher := outbox.NewDispatcher(pool, log)
	identityModule := identity.New(pool, identity.Config{SecureCookies: cfg.SecureCookies}, log)
	ledgerModule := ledger.New(pool, dispatcher, log)
	reportingModule := reporting.New(pool, dispatcher, log)
	marketdataModule := marketdata.New(pool)

	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health(pool))
	identityModule.RegisterRoutes(mux)
	ledgerModule.RegisterRoutes(mux)
	reportingModule.RegisterRoutes(mux)
	marketdataModule.RegisterRoutes(mux, log)
	mux.Handle("/api/", httpserver.NotFound())

	return &App{
		Handler:    httpserver.Middleware(identityModule.RequireSession(mux), log),
		Dispatcher: dispatcher,
		Identity:   identityModule,
		Reporting:  reportingModule,
	}
}
