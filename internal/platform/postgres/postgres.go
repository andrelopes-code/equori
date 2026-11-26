// Package postgres opens the connection pool and applies migrations.
package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// MinMajor is the oldest PostgreSQL major the migrations run on: they call uuidv7().
const MinMajor = 18

// defaultMaxConns is the size of the pool when the URL sets no pool_max_conns. pgx sizes a pool by
// the CPUs of the host, at least 4; a request that holds a transaction and asks the pool for a
// second connection then waits for itself once every connection holds one (a host of 4 CPUs
// stalled a seeding run). The size does not depend on the host.
const defaultMaxConns = 20

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := PoolConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

// PoolConfig reads url and fixes the size of the pool unless pool_max_conns sets it.
func PoolConfig(url string) (*pgxpool.Config, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}

	if !strings.Contains(url, "pool_max_conns") {
		cfg.MaxConns = defaultMaxConns
	}

	return cfg, nil
}

// Locale returns the locale provider (b builtin, c libc, i icu) and locale of the database.
func Locale(ctx context.Context, pool *pgxpool.Pool) (provider, locale string, err error) {
	err = pool.QueryRow(ctx, "SELECT datlocprovider::text, coalesce(datlocale, '') FROM pg_database WHERE datname = current_database()").
		Scan(&provider, &locale)
	if err != nil {
		return "", "", fmt.Errorf("read database locale: %w", err)
	}

	return provider, locale, nil
}
