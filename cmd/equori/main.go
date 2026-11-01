package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"slices"
	"syscall"
	"time"
	_ "time/tzdata" // A book's time zone must resolve in images without a zoneinfo database (BK19).

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/winsvc"
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
		if winsvc.IsService() {
			// The service has no console: serve's error goes to the log opened before the configuration.
			if err = openServiceLog(); err != nil {
				break
			}

			err = winsvc.Run(serviceName, func(ctx context.Context) error {
				err := serve(ctx)
				if err != nil {
					fmt.Fprintln(os.Stderr, err)
				}

				return err
			})

			break
		}

		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		err = serve(ctx)

		stop()
	case "service":
		if err = serviceCommand(os.Args[2:]); errors.Is(err, winsvc.ErrUnsupported) {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
	case "user":
		err = userCommand(os.Args[2:])
	case "reporting":
		err = reportingCommand(os.Args[2:])
	case "portfolio":
		err = portfolioCommand(os.Args[2:])
	case "planning":
		err = planningCommand(os.Args[2:])
	case "secrets":
		err = secretsCommand(os.Args[2:])
	case "backup":
		err = backupCommand(os.Args[2:])
	case "restore":
		err = restoreCommand(os.Args[2:])
	case "healthcheck":
		os.Exit(healthcheck())
	case "version":
		var text string
		if text, err = versionText(buildVersion()); err == nil {
			fmt.Print(text)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q; available: serve, user, reporting, portfolio, planning, secrets, backup, restore, service, healthcheck, version\n", cmd)
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func serve(parent context.Context) error {
	cfg, log, err := setup()
	if err != nil {
		return err
	}

	ring := logring.New(log.Handler(), instance.LogRecordsKept, instance.LogKeys)
	log = slog.New(ring)

	file, err := readEnvFile(os.Getenv)
	if err != nil {
		return err
	}

	schema, err := postgres.LatestVersion()
	if err != nil {
		return err
	}

	log.Info("starting equori", "version", buildVersion(), "schema", schema)

	ctx, stop := context.WithCancel(parent)
	defer stop()

	db, err := openDatabase(ctx, cfg, log, true)
	if err != nil {
		return err
	}
	defer db.Close(log)
	// B7: a database created by the host's locale orders text by that locale.
	provider, locale, err := postgres.Locale(ctx, db.Pool)
	if err != nil {
		return err
	}

	if provider != "b" || locale != "C.UTF-8" {
		log.Warn("text order follows the database host's locale; equori restore of a backup recreates the database with the builtin C.UTF-8 order", "provider", provider, "locale", locale)
	}

	// M6: serve exits when its postgres dies, and the service manager restarts both.
	postgresExit := make(chan error, 1)
	if db.Cluster != nil {
		go func() {
			select {
			case <-db.Cluster.Exited():
				postgresExit <- fmt.Errorf("postgres exited: %w", db.Cluster.ExitErr())

				stop()
			case <-ctx.Done():
			}
		}()
	}

	clk := clock.New(time.Now)
	scfg := serverConfig(cfg, &clk)
	scfg.Web, scfg.WebDevPort, scfg.Version = web.Dist(), cfg.WebDevPort, buildVersion()
	scfg.Instance.Log, scfg.Instance.Environment = ring.Records, envNames(os.Environ(), file)
	scfg.Instance.Dump = func(ctx context.Context, path string) error {
		return backup.Dump(ctx, db.Bin, db.DSN, path)
	}
	scfg.SetupDone = func() {
		if err := removeSetupFile(cfg); err != nil {
			log.Error("first user setup", "error", err)
		}
	}

	app, err := server.New(db.Pool, scfg, log)
	if err != nil {
		return err
	}

	if err := app.Marketdata.ReconcileCurrencies(ctx); err != nil {
		return err
	}

	// W-U1: until the first user exists, the browser creates it with this token.
	token, err := app.Identity.StartSetup(ctx)
	if err != nil {
		return err
	}

	if err := announceSetup(cfg, log, token); err != nil {
		return err
	}

	// The dispatcher and the scheduler must stop before the pool closes.
	dispatcherDone := make(chan error, 1)
	go func() { dispatcherDone <- app.Dispatcher.Run(ctx) }()

	schedulerDone := make(chan struct{})
	go func() {
		defer close(schedulerDone)

		if cfg.SecretKey != "" {
			app.Ingestion.RunScheduler(ctx)
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

	versionsDone := make(chan struct{})
	go func() {
		defer close(versionsDone)

		app.Instance.RunVersionChecks(ctx)
	}()

	backupsDone := make(chan struct{})
	go func() {
		defer close(backupsDone)

		app.Instance.RunBackups(ctx)
	}()

	defer func() {
		stop()
		<-schedulerDone
		<-planningDone
		<-feedsDone
		<-backupsDone
		<-versionsDone

		if err := <-dispatcherDone; err != nil {
			log.Error("outbox dispatcher stopped", "error", err)
		}
	}()

	err = listenError(cfg.HTTPAddr, httpserver.Run(ctx, cfg.HTTPAddr, app.Handler, log))
	select {
	case perr := <-postgresExit:
		return perr
	default:
		return err
	}
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

	db, err := openDatabase(ctx, cfg, log, false)
	if err != nil {
		return err
	}
	defer db.Close(log)

	app, err := server.New(db.Pool, server.Config{}, log)
	if err != nil {
		return err
	}

	return app.Reporting.RebuildAll(ctx)
}

// planningCommand generates the occurrences schedules created before P7 amendment A127 lack.
func planningCommand(args []string) error {
	if len(args) != 1 || args[0] != "backfill" {
		fmt.Fprintln(os.Stderr, "usage: equori planning backfill")
		return errUsage
	}

	cfg, log, err := setup()
	if err != nil {
		return err
	}

	ctx := context.Background()

	db, err := openDatabase(ctx, cfg, log, false)
	if err != nil {
		return err
	}
	defer db.Close(log)

	app, err := server.New(db.Pool, server.Config{}, log)
	if err != nil {
		return err
	}

	return app.Planning.Backfill(ctx)
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

	db, err := openDatabase(ctx, cfg, log, false)
	if err != nil {
		return err
	}
	defer db.Close(log)

	app, err := server.New(db.Pool, server.Config{}, log)
	if err != nil {
		return err
	}

	return app.Portfolio.RebuildAll(ctx)
}

func serverConfig(cfg config.Config, clk *clock.Clock) server.Config {
	mode := "external"
	if cfg.Managed() {
		mode = "managed"
	}

	return server.Config{
		SecureCookies: !cfg.InsecureCookies, Clock: clk, APIDocs: cfg.APIDocs,
		SecretKey: cfg.SecretKey, PreviousSecretKey: cfg.PreviousSecretKey, AggregatorURLs: cfg.AggregatorURLs,
		FeedURLs: cfg.FeedURLs,
		Instance: instance.Config{Mode: mode, BackupDir: cfg.BackupDir, CopyDir: cfg.CopyDir},
	}
}

// families returns the IDs of the aggregators and feeds that the modules offer.
func families() config.Families {
	return config.Families{
		Aggregators: ingestion.AggregatorIDs(),
		Feeds:       slices.Concat(marketdata.SourceIDs(), marketdata.IndexSourceIDs(), marketdata.ExpectationSourceIDs()),
	}
}

func setup() (config.Config, *slog.Logger, error) {
	file, err := readEnvFile(os.Getenv)
	if err != nil {
		return config.Config{}, nil, err
	}

	getenv := config.WithFile(os.Getenv, file)

	cfg, err := config.Load(getenv, families())
	if err != nil {
		return config.Config{}, nil, err
	}

	if cfg.Managed() {
		// W-M3: the first command creates the data directory private, before secret.key lands in it.
		if err := pgcluster.PrepareDataDir(cfg.DataDir); err != nil {
			return config.Config{}, nil, err
		}
	}

	if cfg.Managed() && cfg.SecretKey == "" {
		if cfg.SecretKey, err = secret.LoadOrCreateKey(filepath.Join(cfg.DataDir, "secret.key")); err != nil {
			return config.Config{}, nil, err
		}
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	startWarnings(log, cfg, getenv, envNames(os.Environ(), file))

	return cfg, log, nil
}

// healthcheck backs the container HEALTHCHECK: the distroless image has no curl.
//
//nolint:gosec // G704: host is fixed to 127.0.0.1; only the port comes from EQUORI_HTTP_ADDR.
func healthcheck() int {
	cfg, err := config.Load(os.Getenv, config.Families{})
	if err != nil {
		return 1
	}

	_, port, err := net.SplitHostPort(cfg.HTTPAddr)
	if err != nil {
		return 1
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
