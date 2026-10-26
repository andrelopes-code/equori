package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

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
}

// openDatabase attaches (or, for serve, starts) the managed server, backs up before pending
// migrations in managed mode, and migrates.
func openDatabase(ctx context.Context, cfg config.Config, log *slog.Logger, serving bool) (*database, error) {
	if !cfg.Managed() {
		pool, err := postgres.Open(ctx, cfg.DatabaseURL)
		if err != nil {
			return nil, err
		}
		if err := postgres.Migrate(ctx, pool, log); err != nil {
			pool.Close()
			return nil, err
		}
		return &database{Pool: pool, DSN: cfg.DatabaseURL}, nil
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
	d := &database{Cluster: cluster, DSN: cluster.DSN(pgcluster.Database)}
	if d.Pool, err = postgres.Open(ctx, d.DSN); err != nil {
		_ = cluster.Stop()
		return nil, err
	}
	if err := d.migrateManaged(ctx, cfg, log); err != nil {
		d.Close(log)
		return nil, err
	}
	return d, nil
}

// migrateManaged takes the pre-migration backup of B3, then migrates; a schema ahead of the binary
// names the newest pre-migration backup (V4).
func (d *database) migrateManaged(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	current, pending, err := postgres.Pending(ctx, d.Pool)
	if err != nil {
		return err
	}
	if pending {
		path := filepath.Join(cfg.BackupDir, backup.Name(backup.PreMigration, time.Now().In(cfg.TimeZone), current))
		if err := backup.Dump(ctx, d.Cluster.Bin(), d.DSN, path); err != nil {
			return fmt.Errorf("back up before migrating: %w", err)
		}
		log.Info("backup before migrations", "path", path)
		if err := backup.Prune(cfg.BackupDir, backup.PreMigration, 3); err != nil {
			return err
		}
	}
	err = postgres.Migrate(ctx, d.Pool, log)
	if errors.Is(err, postgres.ErrSchemaAhead) {
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
