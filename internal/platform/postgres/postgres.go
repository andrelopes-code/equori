// Package postgres opens the connection pool and applies migrations.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"math"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/andrelopes-code/equori/db"
)

// ErrSchemaAhead refuses a database migrated by a newer binary (V4 of the distribution design).
var ErrSchemaAhead = errors.New("database schema is newer than this binary")

// MinMajor is the oldest PostgreSQL major the migrations run on: they call uuidv7().
const MinMajor = 18

// LatestVersion returns the highest version among the embedded migrations.
func LatestVersion() (int64, error) {
	names, err := fs.Glob(db.Migrations, "migrations/*.sql")
	if err != nil {
		return 0, fmt.Errorf("list migrations: %w", err)
	}
	var latest int64
	for _, name := range names {
		prefix, _, _ := strings.Cut(filepath.Base(name), "_")
		v, err := strconv.ParseInt(prefix, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse migration version %q: %w", name, err)
		}
		latest = max(latest, v)
	}
	return latest, nil
}

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	return MigrateTo(ctx, pool, math.MaxInt64, log)
}

// MigrateTo applies the migrations up to version; tests of data migrations stop before theirs.
func MigrateTo(ctx context.Context, pool *pgxpool.Pool, version int64, log *slog.Logger) error {
	provider, sqlDB, err := newProvider(pool)
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	current, err := provider.GetDBVersion(ctx)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	sources := provider.ListSources()
	latest := sources[len(sources)-1].Version
	if current > latest {
		return fmt.Errorf("%w: database at version %d, this binary knows up to %d; restore a backup taken before the upgrade, or run a release that knows version %d", ErrSchemaAhead, current, latest, current)
	}
	results, err := provider.UpTo(ctx, version)
	if err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	for _, r := range results {
		log.Info("migration applied", "version", r.Source.Version, "duration", r.Duration)
	}
	return nil
}

// Pending reports the schema version and whether migrations remain; a fresh database (version 0)
// holds nothing to back up, so it reports none.
func Pending(ctx context.Context, pool *pgxpool.Pool) (current int64, pending bool, err error) {
	provider, sqlDB, err := newProvider(pool)
	if err != nil {
		return 0, false, err
	}
	defer sqlDB.Close()
	if current, err = provider.GetDBVersion(ctx); err != nil {
		return 0, false, fmt.Errorf("read schema version: %w", err)
	}
	latest, err := LatestVersion()
	if err != nil {
		return 0, false, err
	}
	return current, current > 0 && current < latest, nil
}

// Locale returns the locale provider (b builtin, c libc, i icu) and locale of the database.
func Locale(ctx context.Context, pool *pgxpool.Pool) (provider, locale string, err error) {
	err = pool.QueryRow(ctx, "SELECT datlocprovider::text, coalesce(datlocale, '') FROM pg_database WHERE datname = current_database()").Scan(&provider, &locale)
	if err != nil {
		return "", "", fmt.Errorf("read database locale: %w", err)
	}
	return provider, locale, nil
}

func newProvider(pool *pgxpool.Pool) (*goose.Provider, *sql.DB, error) {
	dir, err := fs.Sub(db.Migrations, "migrations")
	if err != nil {
		return nil, nil, err
	}
	sqlDB := stdlib.OpenDBFromPool(pool)
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, dir)
	if err != nil {
		_ = sqlDB.Close()
		return nil, nil, fmt.Errorf("create migration provider: %w", err)
	}
	return provider, sqlDB, nil
}
