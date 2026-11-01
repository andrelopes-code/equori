package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

type database struct {
	Pool    *pgxpool.Pool
	Cluster *pgcluster.Cluster // nil in external mode
	DSN     string             // connection string for pg_dump and pg_restore
	Bin     string             // programs directory; "" in external mode without EQUORI_BACKUP_DIR
}

// openDatabase attaches (or, for serve, starts) the managed server, backs up before pending
// migrations when a backup directory is set, and migrates.
func openDatabase(ctx context.Context, cfg config.Config, log *slog.Logger, serving bool) (*database, error) {
	if !cfg.Managed() {
		return openExternal(ctx, cfg, log)
	}

	bin, err := pgcluster.Bin(cfg.PostgresBin)
	if err != nil {
		return nil, err
	}

	open := pgcluster.Attach
	if serving {
		open = pgcluster.Start
	}

	cluster, err := open(ctx, cfg.DataDir, bin)
	if err != nil {
		return nil, err
	}

	d := &database{Cluster: cluster, DSN: cluster.DSN(pgcluster.Database), Bin: cluster.Bin()}
	if d.Pool, err = postgres.Open(ctx, d.DSN); err != nil {
		_ = cluster.Stop()
		return nil, err
	}

	if err := d.migrate(ctx, cfg, log); err != nil {
		d.Close(log)
		return nil, err
	}

	return d, nil
}

// openExternal opens the database named by EQUORI_DATABASE_URL. With EQUORI_BACKUP_DIR set, the
// programs must exist before the migration, so that a missing pg_dump never skips the backup (A154.4).
func openExternal(ctx context.Context, cfg config.Config, log *slog.Logger) (*database, error) {
	d := &database{DSN: cfg.DatabaseURL}

	if cfg.BackupDir != "" {
		bin, err := pgcluster.Bin(cfg.PostgresBin)
		if err != nil {
			return nil, fmt.Errorf("back up before migrating into %s: %w", cfg.BackupDir, err)
		}

		d.Bin = bin
	}

	pool, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, connectError(cfg.DatabaseURL, err)
	}

	d.Pool = pool

	if err := d.migrate(ctx, cfg, log); err != nil {
		d.Close(log)
		return nil, err
	}

	return d, nil
}

// connectError names the database of EQUORI_DATABASE_URL without its password (A161.5).
func connectError(databaseURL string, err error) error {
	pc, perr := pgx.ParseConfig(databaseURL)
	if perr != nil {
		return fmt.Errorf("cannot connect to the database of EQUORI_DATABASE_URL: %w", err)
	}

	return fmt.Errorf(
		"cannot connect to the database of EQUORI_DATABASE_URL (host %s, port %d, database %s): %w",
		pc.Host,
		pc.Port,
		pc.Database,
		err,
	)
}

// migrate takes the pre-migration backup of B3 when a backup directory is set, then migrates; a
// schema ahead of the binary names the newest pre-migration backup (V4).
func (d *database) migrate(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	current, pending, err := postgres.Pending(ctx, d.Pool)
	if err != nil {
		return err
	}

	if pending && cfg.BackupDir != "" {
		path := filepath.Join(cfg.BackupDir, backup.Name(backup.PreMigration, time.Now().UTC(), current))
		if err := backup.Dump(ctx, d.Bin, d.DSN, path); err != nil {
			return fmt.Errorf("back up before migrating into %s: %w", cfg.BackupDir, err)
		}

		log.Info("backup before migrations", "path", path)

		if err := backup.Prune(cfg.BackupDir, backup.PreMigration, 3); err != nil {
			return err
		}
	}

	err = postgres.Migrate(ctx, d.Pool, log)
	if errors.Is(err, postgres.ErrSchemaAhead) && cfg.BackupDir != "" {
		if newest, nerr := backup.Newest(cfg.BackupDir, backup.PreMigration); nerr == nil && newest != "" {
			return fmt.Errorf("%w; newest pre-migration backup: %s (equori restore %s)", err, newest, newest)
		}
	}

	return err
}

func (d *database) Close(log *slog.Logger) {
	if d.Pool != nil {
		d.Pool.Close()
	}

	if d.Cluster != nil {
		if err := d.Cluster.Stop(); err != nil {
			log.Error("stop postgres", "error", err)
		}
	}
}
