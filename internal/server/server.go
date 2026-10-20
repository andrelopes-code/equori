// Package server composes the modules into the HTTP handler and the outbox
// dispatcher. cmd/equori and internal/apitest build the application through it.
package server

import (
	"io/fs"
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
	"github.com/andrelopes-code/equori/internal/planning"
	"github.com/andrelopes-code/equori/internal/platform/apidoc"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/spa"
	"github.com/andrelopes-code/equori/internal/portfolio"
	"github.com/andrelopes-code/equori/internal/reporting"
)

type Config struct {
	SecureCookies bool
	// Clock defaults to the current time in UTC when nil.
	Clock *clock.Clock
	// Web holds the built single-page application; nil answers 404 outside /api/.
	Web fs.FS
	// WebDevPort, when set, redirects every path outside /api/ to the Vite server on that port
	// instead of serving Web (ADR 008, development).
	WebDevPort int
	// APIDocs registers GET /docs and GET /openapi.yaml.
	APIDocs bool
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset.
	SecretKey, PreviousSecretKey string
	PluggyURL                    string
	// LLM routes language model calls (ADR 009); modules take clients from it.
	LLM *llm.Router
	// PTAXFeed and COTAHISTFeed enable the price feeds at their base URLs (P8 amendment A62).
	PTAXFeed, COTAHISTFeed bool
	PTAXURL, COTAHISTURL   string
}

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	Identity   *identity.Module
	Marketdata *marketdata.Module
	Ledger     *ledger.Module
	Reporting  *reporting.Module
	Ingestion  *ingestion.Module
	Planning   *planning.Module
	Portfolio  *portfolio.Module
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
	marketdataModule := marketdata.New(pool).WithFeeds(marketdata.FeedConfig{
		PTAX: cfg.PTAXFeed, COTAHIST: cfg.COTAHISTFeed, PTAXURL: cfg.PTAXURL, COTAHISTURL: cfg.COTAHISTURL,
		Client: &http.Client{Timeout: time.Minute}, Clock: clk, Log: log,
	})
	ledgerModule := ledger.New(pool, dispatcher, marketdataModule, clk, log)
	reportingModule := reporting.New(pool, dispatcher, log)
	classificationModule := classification.New(pool, dispatcher, ledgerModule, log)
	ingestionModule, err := ingestion.New(pool, dispatcher, ledgerModule, classificationModule, ingestion.Config{
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, PluggyURL: cfg.PluggyURL, Clock: clk,
	}, log)
	if err != nil {
		return nil, err
	}
	planningModule := planning.New(pool, dispatcher, ledgerModule, marketdataModule, clk, log)
	portfolioModule := portfolio.New(pool, dispatcher, ledgerModule, marketdataModule, log)

	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health(pool))
	if cfg.APIDocs {
		apidoc.Register(mux, api.Contract)
	}
	identityModule.RegisterRoutes(mux)
	ledgerModule.RegisterRoutes(mux)
	reportingModule.RegisterRoutes(mux)
	ingestionModule.RegisterRoutes(mux)
	classificationModule.RegisterRoutes(mux)
	planningModule.RegisterRoutes(mux)
	portfolioModule.RegisterRoutes(mux)
	marketdataModule.RegisterRoutes(mux, log)
	mux.Handle("/api/", httpserver.NotFound())
	// Method-less: "GET /" overlaps "/api/" without either being more specific, and ServeMux panics.
	if cfg.WebDevPort != 0 {
		mux.Handle("/", spa.DevRedirect(cfg.WebDevPort))
	} else {
		mux.Handle("/", spa.Handler(cfg.Web))
	}

	return &App{
		Handler: httpserver.Middleware(identityModule.RequireSession(validator.Middleware(mux)), log,
			append(ledgerModule.BodyLimits(), ingestionModule.BodyLimits()...)...),
		Dispatcher: dispatcher,
		Identity:   identityModule,
		Ledger:     ledgerModule,
		Reporting:  reportingModule,
		Ingestion:  ingestionModule,
		Planning:   planningModule,
		Portfolio:  portfolioModule,
		Marketdata: marketdataModule,
	}, nil
}
