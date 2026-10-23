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

	"github.com/andrelopes-code/equori/internal/capture"
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
	"github.com/andrelopes-code/equori/internal/platform/tool"
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
	// AggregatorURLs overrides the base URL of an aggregator, by identifier.
	AggregatorURLs map[string]string
	// LLM routes language model calls (ADR 009); modules take clients from it.
	LLM *llm.Router
	// PriceFeeds names the enabled price feeds; FeedURLs overrides their base URLs by identifier.
	PriceFeeds []string
	// IndexFeeds names the enabled index feeds; FeedURLs overrides their base URLs too.
	IndexFeeds []string
	FeedURLs   map[string]string
}

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	// Tools holds every module's tools for language models (ADR 012).
	Tools      *tool.Registry
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
	feedClient := &http.Client{Timeout: time.Minute}
	sources, err := marketdata.NewSources(cfg.PriceFeeds, cfg.FeedURLs, feedClient)
	if err != nil {
		return nil, err
	}
	indexSources, err := marketdata.NewIndexSources(cfg.IndexFeeds, cfg.FeedURLs, feedClient)
	if err != nil {
		return nil, err
	}
	marketdataModule := marketdata.New(pool).WithFeeds(marketdata.FeedConfig{
		Sources: sources, Indexes: indexSources, Client: feedClient, Clock: clk, Log: log,
	})
	ledgerModule := ledger.New(pool, dispatcher, marketdataModule, identityModule, clk, log)
	reportingModule := reporting.New(pool, dispatcher, log)
	classificationModule := classification.New(pool, dispatcher, ledgerModule, log)
	captureModule := capture.New(pool, ledgerModule, classificationModule, identityModule, cfg.LLM, clk, log)
	ingestionModule, err := ingestion.New(pool, dispatcher, ledgerModule, classificationModule, ingestion.Config{
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, URLs: cfg.AggregatorURLs, Clock: clk,
	}, log)
	if err != nil {
		return nil, err
	}
	planningModule := planning.New(pool, dispatcher, ledgerModule, marketdataModule, identityModule, clk, log)
	portfolioModule, err := portfolio.New(pool, dispatcher, ledgerModule, marketdataModule, identityModule, log)
	if err != nil {
		return nil, err
	}
	tools, err := tool.NewRegistry(log, ledgerModule.Tools(), reportingModule.Tools())
	if err != nil {
		return nil, err
	}

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
	captureModule.RegisterRoutes(mux)
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
		Tools:      tools,
		Identity:   identityModule,
		Ledger:     ledgerModule,
		Reporting:  reportingModule,
		Ingestion:  ingestionModule,
		Planning:   planningModule,
		Portfolio:  portfolioModule,
		Marketdata: marketdataModule,
	}, nil
}
