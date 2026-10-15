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
	"syscall"
	"time"
	_ "time/tzdata" // EQUORI_TIMEZONE must resolve in images without a zoneinfo database.

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/server"
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
	case "healthcheck":
		os.Exit(healthcheck())
	case "version":
		fmt.Println(buildVersion())
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q; available: serve, user, reporting, healthcheck, version\n", cmd)
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
	app, err := server.New(pool, server.Config{SecureCookies: !cfg.InsecureCookies, Clock: &clk}, log)
	if err != nil {
		return err
	}

	// The dispatcher must stop before the pool closes.
	dispatcherDone := make(chan error, 1)
	go func() { dispatcherDone <- app.Dispatcher.Run(ctx) }()
	defer func() {
		stop()
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
