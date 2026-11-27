package main

import (
	"cmp"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/server"
)

// background holds the completion signals of the loops that serve starts after the application
// is built.
type background struct {
	dispatcherDone chan error
	schedulerDone  chan struct{}
	planningDone   chan struct{}
	feedsDone      chan struct{}
	versionsDone   chan struct{}
	backupsDone    chan struct{}
}

func runServe() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := serve(ctx)

	stop()

	return err
}

func serve(parent context.Context) error {
	cfg, log, file, err := setupWithFile()
	if err != nil {
		return err
	}

	ring, log := withLogRing(log)

	if err := logStart(log); err != nil {
		return err
	}

	ctx, stop := context.WithCancel(parent)
	defer stop()

	db, err := openDatabase(ctx, cfg, log, true)
	if err != nil {
		return err
	}
	defer db.Close(log)

	if err := checkLocale(ctx, db, log); err != nil {
		return err
	}

	postgresExit := watchPostgres(ctx, stop, db)

	app, err := server.New(db.Pool, serveConfig(cfg, file, ring, db, log), log)
	if err != nil {
		return err
	}

	if err := prepareApp(ctx, app, cfg, log); err != nil {
		return err
	}

	bg := startBackground(ctx, app, cfg)
	defer bg.Stop(stop, log)

	return runHTTP(ctx, cfg, app, log, postgresExit)
}

func logStart(log *slog.Logger) error {
	schema, err := postgres.LatestVersion()
	if err != nil {
		return err
	}

	log.Info("starting equori", "version", buildVersion(), "schema", schema)

	return nil
}

func checkLocale(ctx context.Context, db *database, log *slog.Logger) error {
	// B7: a database created by the host's locale orders text by that locale.
	provider, locale, err := postgres.Locale(ctx, db.Pool)
	if err != nil {
		return err
	}

	if provider != "b" || locale != "C.UTF-8" {
		log.Warn("text order follows the database host's locale; "+
			"equori restore of a backup recreates the database with the builtin C.UTF-8 order",
			"provider", provider, "locale", locale)
	}

	return nil
}

// watchPostgres returns the channel that receives the exit of the managed postgres.
func watchPostgres(ctx context.Context, stop context.CancelFunc, db *database) <-chan error {
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

	return postgresExit
}

func prepareApp(ctx context.Context, app *server.App, cfg config.Config, log *slog.Logger) error {
	if err := app.Marketdata.ReconcileCurrencies(ctx); err != nil {
		return err
	}

	// A release that changes a tax rule reaches the rows already derived without an operator.
	// A build without a module version (go test) reads as unknown.
	if err := app.Portfolio.RebuildForVersion(ctx, cmp.Or(buildVersion(), "unknown")); err != nil {
		return err
	}

	// W-U1: until the first user exists, the browser creates it with this token.
	token, err := app.Identity.StartSetup(ctx)
	if err != nil {
		return err
	}

	return announceSetup(cfg, log, token)
}

func startBackground(ctx context.Context, app *server.App, cfg config.Config) *background {
	bg := &background{
		dispatcherDone: make(chan error, 1),
		schedulerDone:  make(chan struct{}),
	}

	go func() { bg.dispatcherDone <- app.Dispatcher.Run(ctx) }()

	go func() {
		defer close(bg.schedulerDone)

		if cfg.SecretKey != "" {
			app.Ingestion.RunScheduler(ctx)
		}
	}()

	startPeriodic(ctx, app, bg)

	return bg
}

func startPeriodic(ctx context.Context, app *server.App, bg *background) {
	// P7 amendment A53: the occurrence horizon moves with the clock.
	bg.planningDone = make(chan struct{})
	go func() {
		defer close(bg.planningDone)

		app.Planning.RunScheduler(ctx, time.Hour)
	}()

	// P8 amendment A62: price feeds run at start and every 6 hours when enabled.
	bg.feedsDone = make(chan struct{})
	go func() {
		defer close(bg.feedsDone)

		app.Marketdata.RunFeeds(ctx, 6*time.Hour)
	}()

	bg.versionsDone = make(chan struct{})
	go func() {
		defer close(bg.versionsDone)

		app.Instance.RunVersionChecks(ctx)
	}()

	bg.backupsDone = make(chan struct{})
	go func() {
		defer close(bg.backupsDone)

		app.Instance.RunBackups(ctx)
	}()
}

// Stop cancels the context and waits for the loops. The dispatcher and the scheduler must stop
// before the pool closes.
func (b *background) Stop(stop context.CancelFunc, log *slog.Logger) {
	stop()
	<-b.schedulerDone
	<-b.planningDone
	<-b.feedsDone
	<-b.backupsDone
	<-b.versionsDone

	if err := <-b.dispatcherDone; err != nil {
		log.Error("outbox dispatcher stopped", "error", err)
	}
}

func runHTTP(
	ctx context.Context,
	cfg config.Config,
	app *server.App,
	log *slog.Logger,
	postgresExit <-chan error,
) error {
	err := listenError(cfg.HTTPAddr, httpserver.Run(ctx, cfg.HTTPAddr, app.Handler, log))
	select {
	case perr := <-postgresExit:
		return perr
	default:
		return err
	}
}
