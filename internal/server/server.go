// Package server composes the modules into the HTTP handler and the outbox
// dispatcher. cmd/equori and internal/apitest build the application through it.
package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/platform/contract"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/reporting"
)

type Config struct {
	SecureCookies bool
	// Clock defaults to the current time in UTC when nil.
	Clock *clock.Clock
}

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	Identity   *identity.Module
	Ledger     *ledger.Module
	Reporting  *reporting.Module
}

// New registers every module's routes and outbox subscriptions; the caller runs Dispatcher.
func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*App, error) {
	validator, err := contract.New(api.Contract, "/api/v1")
	if err != nil {
		return nil, err
	}
	dispatcher := outbox.NewDispatcher(pool, log)
	clk := clock.New(time.UTC, time.Now)
	if cfg.Clock != nil {
		clk = *cfg.Clock
	}
	identityModule := identity.New(pool, identity.Config{SecureCookies: cfg.SecureCookies}, log)
	marketdataModule := marketdata.New(pool)
	ledgerModule := ledger.New(pool, dispatcher, marketdataModule, clk, log)
	reportingModule := reporting.New(pool, dispatcher, log)
	classificationModule := classification.New(pool, dispatcher, ledgerModule, log)
	ingestionModule := ingestion.New(pool, ledgerModule, log)

	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health(pool))
	identityModule.RegisterRoutes(mux)
	ledgerModule.RegisterRoutes(mux)
	reportingModule.RegisterRoutes(mux)
	ingestionModule.RegisterRoutes(mux)
	classificationModule.RegisterRoutes(mux)
	marketdataModule.RegisterRoutes(mux, log)
	mux.Handle("/api/", httpserver.NotFound())

	return &App{
		Handler: httpserver.Middleware(identityModule.RequireSession(validator.Middleware(mux)), log,
			append(ledgerModule.BodyLimits(), ingestionModule.BodyLimits()...)...),
		Dispatcher: dispatcher,
		Identity:   identityModule,
		Ledger:     ledgerModule,
		Reporting:  reportingModule,
	}, nil
}
