package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata" // EQUORI_TIMEZONE must resolve in images without a zoneinfo database.

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/server"
	"github.com/andrelopes-code/equori/web"
)

// version is set at build time with -ldflags "-X main.version=...".
var version string

func main() {
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	var err error
	switch cmd {
	case "serve":
		err = serve()
	case "user":
		err = userCommand(os.Args[2:])
	case "reporting":
		err = reportingCommand(os.Args[2:])
	case "portfolio":
		err = portfolioCommand(os.Args[2:])
	case "secrets":
		err = secretsCommand(os.Args[2:])
	case "healthcheck":
		os.Exit(healthcheck())
	case "version":
		fmt.Println(buildVersion())
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q; available: serve, user, reporting, portfolio, secrets, healthcheck, version\n", cmd)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func serve() error {
	cfg, log, err := setup()
	if err != nil {
		return err
	}
	log.Info("starting equori", "version", buildVersion(), "timezone", cfg.TimeZone.String())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := openDatabase(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer pool.Close()

	clk := clock.New(cfg.TimeZone, time.Now)
	router := llmRouter(cfg, &clk, log)
	log.Info("llm providers", "providers", router.Providers())
	scfg := serverConfig(cfg, &clk, router)
	scfg.Web, scfg.WebDevPort = web.Dist(), cfg.WebDevPort
	app, err := server.New(pool, scfg, log)
	if err != nil {
		return err
	}
	if err := app.Marketdata.ReconcileCurrencies(ctx); err != nil {
		return err
	}

	// The dispatcher and the scheduler must stop before the pool closes.
	dispatcherDone := make(chan error, 1)
	go func() { dispatcherDone <- app.Dispatcher.Run(ctx) }()
	schedulerDone := make(chan struct{})
	go func() {
		defer close(schedulerDone)
		if cfg.SecretKey != "" {
			app.Ingestion.RunScheduler(ctx, cfg.SyncInterval)
		}
	}()
	// P7 amendment A53: the occurrence horizon moves with the clock.
	planningDone := make(chan struct{})
	go func() {
		defer close(planningDone)
		app.Planning.RunScheduler(ctx, time.Hour)
	}()
	// P8 amendment A62: price feeds run at start and every 6 hours when enabled.
	feedsDone := make(chan struct{})
	go func() {
		defer close(feedsDone)
		app.Marketdata.RunFeeds(ctx, 6*time.Hour)
	}()
	defer func() {
		stop()
		<-schedulerDone
		<-planningDone
		<-feedsDone
		if err := <-dispatcherDone; err != nil {
			log.Error("outbox dispatcher stopped", "error", err)
		}
	}()

	return httpserver.Run(ctx, cfg.HTTPAddr, app.Handler, log)
}

// reportingCommand rebuilds every derived balance series from the ledger.
func reportingCommand(args []string) error {
	if len(args) != 1 || args[0] != "rebuild" {
		fmt.Fprintln(os.Stderr, "usage: equori reporting rebuild")
		return errUsage
	}
	cfg, log, err := setup()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := openDatabase(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer pool.Close()
	app, err := server.New(pool, server.Config{}, log)
	if err != nil {
		return err
	}
	return app.Reporting.RebuildAll(ctx)
}

// portfolioCommand rebuilds every derived position, result and income event from the ledger.
func portfolioCommand(args []string) error {
	if len(args) != 1 || args[0] != "rebuild" {
		fmt.Fprintln(os.Stderr, "usage: equori portfolio rebuild")
		return errUsage
	}
	cfg, log, err := setup()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := openDatabase(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer pool.Close()
	app, err := server.New(pool, server.Config{}, log)
	if err != nil {
		return err
	}
	return app.Portfolio.RebuildAll(ctx)
}

func serverConfig(cfg config.Config, clk *clock.Clock, router *llm.Router) server.Config {
	return server.Config{
		SecureCookies: !cfg.InsecureCookies, Clock: clk, APIDocs: cfg.APIDocs,
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, AggregatorURLs: aggregatorURLs(os.Getenv),
		LLM: router, PriceFeeds: cfg.PriceFeeds, IndexFeeds: cfg.IndexFeeds, FeedURLs: feedURLs(os.Getenv),
	}
}

// aggregatorURLs reads EQUORI_AGGREGATOR_<ID>_URL for each aggregator the ingestion module offers.
func aggregatorURLs(getenv func(string) string) map[string]string {
	urls := make(map[string]string)
	for _, id := range ingestion.AggregatorIDs() {
		if v := getenv("EQUORI_AGGREGATOR_" + strings.ToUpper(id) + "_URL"); v != "" {
			urls[id] = v
		}
	}
	return urls
}

// feedURLs reads EQUORI_FEED_<ID>_URL for each price feed the marketdata module offers.
func feedURLs(getenv func(string) string) map[string]string {
	urls := make(map[string]string)
	for _, id := range append(marketdata.SourceIDs(), marketdata.IndexSourceIDs()...) {
		if v := getenv("EQUORI_FEED_" + strings.ToUpper(id) + "_URL"); v != "" {
			urls[id] = v
		}
	}
	return urls
}

// llmRouter registers the language model providers whose credentials are configured.
func llmRouter(cfg config.Config, clk *clock.Clock, log *slog.Logger) *llm.Router {
	var providers []llm.Provider
	if cfg.GeminiAPIKey != "" {
		providers = append(providers, aistudio.New(cfg.GeminiURL, cfg.GeminiAPIKey, &http.Client{Timeout: 2 * time.Minute}))
	}
	return llm.NewRouter(clk, log, providers...)
}

func setup() (config.Config, *slog.Logger, error) {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return config.Config{}, nil, err
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	return cfg, log, nil
}

func openDatabase(ctx context.Context, cfg config.Config, log *slog.Logger) (*pgxpool.Pool, error) {
	pool, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if err := postgres.Migrate(ctx, pool, log); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// healthcheck backs the container HEALTHCHECK: the distroless image has no curl.
//
//nolint:gosec // G704: host is fixed to 127.0.0.1; only the port comes from EQUORI_HTTP_ADDR.
func healthcheck() int {
	port := "8080"
	if addr := os.Getenv("EQUORI_HTTP_ADDR"); addr != "" {
		_, p, err := net.SplitHostPort(addr)
		if err != nil {
			return 1
		}
		port = p
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+net.JoinHostPort("127.0.0.1", port)+"/healthz", nil)
	if err != nil {
		return 1
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func buildVersion() string {
	if version != "" {
		return version
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		return info.Main.Version
	}
	return "unknown"
}
