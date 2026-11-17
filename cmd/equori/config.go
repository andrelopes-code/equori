package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/server"
	"github.com/andrelopes-code/equori/web"
)

func serverConfig(cfg config.Config, clk *clock.Clock) server.Config {
	mode := "external"
	if cfg.Managed() {
		mode = "managed"
	}

	return server.Config{
		SecureCookies:     !cfg.InsecureCookies,
		Clock:             clk,
		APIDocs:           cfg.APIDocs,
		SecretKey:         cfg.SecretKey,
		PreviousSecretKey: cfg.PreviousSecretKey,
		AggregatorURLs:    cfg.AggregatorURLs,
		FeedURLs:          cfg.FeedURLs,
		Instance: instance.Config{
			Mode:         mode,
			BackupDir:    cfg.BackupDir,
			CopyDir:      cfg.CopyDir,
			Distribution: cfg.Distribution,
		},
	}
}

// serveConfig extends serverConfig with the values only serve has: the web assets, the log
// ring, the environment names and the database dump.
func serveConfig(
	cfg config.Config,
	file map[string]string,
	ring *logring.Ring,
	db *database,
	log *slog.Logger,
) server.Config {
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

	return scfg
}

// families returns the IDs of the aggregators and feeds that the modules offer.
func families() config.Families {
	return config.Families{
		Aggregators: ingestion.AggregatorIDs(),
		Feeds: slices.Concat(
			marketdata.SourceIDs(),
			marketdata.IndexSourceIDs(),
			marketdata.ExpectationSourceIDs(),
			marketdata.CurveSourceIDs(),
			marketdata.InstitutionSourceIDs(),
		),
	}
}

func setup() (config.Config, *slog.Logger, error) {
	cfg, log, _, err := setupWithFile()

	return cfg, log, err
}

// setupWithFile is setup that also returns the environment file it read.
func setupWithFile() (config.Config, *slog.Logger, map[string]string, error) {
	file, err := readEnvFile(os.Getenv)
	if err != nil {
		return config.Config{}, nil, nil, err
	}

	getenv := config.WithFile(os.Getenv, file)

	cfg, err := config.Load(getenv, families())
	if err != nil {
		return config.Config{}, nil, nil, err
	}

	if cfg.Managed() {
		// W-M3: the first command creates the data directory private, before secret.key lands in it.
		if err := pgcluster.PrepareDataDir(cfg.DataDir); err != nil {
			return config.Config{}, nil, nil, err
		}
	}

	log := newLogger(cfg)

	if err := loadSecretKey(&cfg, getenv, log); err != nil {
		return config.Config{}, nil, nil, err
	}

	startWarnings(log, cfg, getenv, envNames(os.Environ(), file))

	return cfg, log, file, nil
}

// loadSecretKey sets cfg.SecretKey from secret.key when the variable is empty.
func loadSecretKey(cfg *config.Config, getenv func(string) string, log *slog.Logger) error {
	keyDir := keyDirectory(*cfg, getenv)
	if cfg.SecretKey != "" || keyDir == "" {
		return nil
	}

	key, err := secret.LoadOrCreateKey(filepath.Join(keyDir, "secret.key"))

	switch {
	case err == nil:
		cfg.SecretKey = key
	case cfg.Managed():
		return err
	default:
		// External mode ran before without a key file: an unusable directory costs the key,
		// not the start.
		log.Warn("secret.key is unavailable", "dir", keyDir, "error", err)
	}

	return nil
}

// keyDirectory is where secret.key lives: the data directory in managed mode, else EQUORI_DATA_DIR
// when set (ADR 008, K6). Empty means no key file.
func keyDirectory(cfg config.Config, getenv func(string) string) string {
	if cfg.Managed() {
		return cfg.DataDir
	}

	return getenv("EQUORI_DATA_DIR")
}
