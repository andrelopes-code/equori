// Package server composes the modules into the HTTP handler and the outbox
// dispatcher. cmd/equori and internal/apitest build the application through it.
package server

import (
	"cmp"
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/platform/contract"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant"
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
	"github.com/andrelopes-code/equori/internal/platform/tool/mcp"
	"github.com/andrelopes-code/equori/internal/portfolio"
	"github.com/andrelopes-code/equori/internal/reporting"
	"github.com/andrelopes-code/equori/web"
)

type Config struct {
	// Version is the version of the running app; "dev" when empty (ADR 021).
	Version       string
	SecureCookies bool
	// SetupDone runs after the first user is created from the browser (W-U5).
	SetupDone func()
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
	// LLMProviders are the language model providers configured for the whole instance
	// (ADR 009); each user adds their own (ADR 019).
	LLMProviders []llm.Provider
	// LLMFactory builds a user's provider; nil builds the real adapters. Tests replace it.
	LLMFactory func(api, baseURL, key string) llm.Provider
	// LLMWait blocks a chat turn until a transient cooldown ends; nil uses a timer on Clock.
	LLMWait func(ctx context.Context, until time.Time) error
	// PriceFeeds and IndexFeeds name the feeds enabled while no feed setting is stored (ADR 025
	// F2); FeedURLs overrides the base URLs of every feed by identifier.
	PriceFeeds []string
	IndexFeeds []string
	FeedURLs   map[string]string
	// ExtraTools join the registry and the chat set; production passes none.
	ExtraTools []tool.Group
}

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	// Tools holds every module's tools for language models (ADR 012).
	Tools     *tool.Registry
	Identity  *identity.Module
	Assistant *assistant.Module
	// LLM routes language model calls of every use (ADR 009).
	LLM        *llm.Router
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
	identityModule := identity.New(pool, identity.Config{
		SecureCookies: cfg.SecureCookies, DefaultCurrency: ledger.DefaultBaseCurrency, SetupDone: cfg.SetupDone,
	}, log)
	feedClient := &http.Client{Timeout: time.Minute}
	// The variables are validated here and seed the stored feed settings (ADR 025 F2, F4).
	if _, err := marketdata.NewSources(cfg.PriceFeeds, nil, feedClient); err != nil {
		return nil, err
	}
	if _, err := marketdata.NewIndexSources(cfg.IndexFeeds, nil, feedClient); err != nil {
		return nil, err
	}
	sources, err := marketdata.NewSources(marketdata.SourceIDs(), cfg.FeedURLs, feedClient)
	if err != nil {
		return nil, err
	}
	indexSources, err := marketdata.NewIndexSources(marketdata.IndexSourceIDs(), cfg.FeedURLs, feedClient)
	if err != nil {
		return nil, err
	}
	marketdataModule := marketdata.New(pool).WithFeeds(marketdata.FeedConfig{
		Sources: sources, Indexes: indexSources, Seed: slices.Concat(cfg.PriceFeeds, cfg.IndexFeeds),
		Client: feedClient, Clock: clk, Log: log,
	})
	marketdataModule.WithProfiles(identityModule).WithAdmins(identityModule)
	ledgerModule := ledger.New(pool, dispatcher, marketdataModule, identityModule, clk, log)
	version := cmp.Or(cfg.Version, "dev")
	reportingModule := reporting.New(pool, dispatcher, clk, log, version)
	classificationModule := classification.New(pool, dispatcher, ledgerModule, log)
	assistantModule, err := assistant.New(pool, assistant.Config{
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, Instance: cfg.LLMProviders,
		Uses: []llm.Use{capture.SuggestUse, assistant.ChatUse}, Navigation: web.NavigationMap(), Locale: identityModule.Profile, Clock: clk, NewProvider: cfg.LLMFactory,
		Wait: cfg.LLMWait,
	}, log)
	if err != nil {
		return nil, err
	}
	router := llm.NewRouter(&clk, log, assistantModule.Resolver(), cfg.LLMProviders...)
	assistantModule.UseRouter(router)
	captureModule := capture.New(pool, ledgerModule, classificationModule, identityModule, router, clk, log)
	ingestionModule, err := ingestion.New(pool, dispatcher, ledgerModule, classificationModule, ingestion.Config{
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, URLs: cfg.AggregatorURLs, Clock: clk,
	}, log)
	if err != nil {
		return nil, err
	}
	portfolioModule, err := portfolio.New(pool, dispatcher, ledgerModule, marketdataModule, identityModule, log)
	if err != nil {
		return nil, err
	}
	reportingModule.OnImport(portfolioModule.RebuildUser)
	planningModule := planning.New(pool, dispatcher, ledgerModule, marketdataModule, identityModule, portfolioModule, clk, log)
	reportingModule.UseIndicatorSources(planningModule, portfolioModule)
	tools, err := tool.NewRegistry(log, append([]tool.Group{ledgerModule.Tools(), reportingModule.Tools(), ingestionModule.Tools(), planningModule.Tools(), portfolioModule.Tools(), marketdataModule.Tools(), classificationModule.Tools(), identityModule.Tools(), assistantModule.Tools()}, cfg.ExtraTools...)...)
	if err != nil {
		return nil, err
	}
	chatNames := slices.Collect(func(yield func(string) bool) {
		for _, t := range tools.Tools() {
			if !yield(t.Spec().Name) {
				return
			}
		}
	})
	chatTools, err := tools.Select(chatNames...)
	if err != nil {
		return nil, err
	}
	if err := assistantModule.UseTools(chatTools); err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health(pool))
	if cfg.APIDocs {
		apidoc.Register(mux, api.Contract)
	}
	identityModule.RegisterRoutes(mux)
	assistantModule.RegisterRoutes(mux)
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

	// /mcp sits outside /api/ and its session gate: a personal access token opens it, and only it (ADR 024).
	root := http.NewServeMux()
	root.Handle("/mcp", mcp.New(mcp.Config{
		Registry: tools, Names: chatNames, Instructions: assistant.Instructions(), Prompts: mcpPrompts(), Version: version, Log: log,
		Verify: func(ctx context.Context, token string) (mcp.Grant, error) {
			g, err := identityModule.VerifyAccessToken(ctx, token)
			if errors.Is(err, identity.ErrInvalidAccessToken) {
				return mcp.Grant{}, mcp.ErrInvalidToken
			}
			if err != nil {
				return mcp.Grant{}, err
			}
			return mcp.Grant{TokenID: g.TokenID.String(), UserID: g.UserID, Write: g.Scope == "write"}, nil
		},
	}))
	root.Handle("/", identityModule.RequireSession(validator.Middleware(mux)))

	return &App{
		Handler: httpserver.Middleware(root, log,
			slices.Concat(ledgerModule.BodyLimits(), ingestionModule.BodyLimits(), reportingModule.BodyLimits())...),
		Dispatcher: dispatcher,
		Tools:      tools,
		Identity:   identityModule,
		Assistant:  assistantModule,
		LLM:        router,
		Ledger:     ledgerModule,
		Reporting:  reportingModule,
		Ingestion:  ingestionModule,
		Planning:   planningModule,
		Portfolio:  portfolioModule,
		Marketdata: marketdataModule,
	}, nil
}

// mcpPrompts hands the assistant's prompts to the MCP adapter, which knows no module.
func mcpPrompts() []mcp.Prompt {
	var out []mcp.Prompt
	for _, p := range assistant.Prompts() {
		args := make([]mcp.PromptArgument, 0, len(p.Arguments))
		for _, a := range p.Arguments {
			args = append(args, mcp.PromptArgument(a))
		}
		out = append(out, mcp.Prompt{Name: p.Name, Description: p.Description, Arguments: args, Render: p.Render})
	}
	return out
}
