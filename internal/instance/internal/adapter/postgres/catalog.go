package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/instance/internal/app"
	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	platformpostgres "github.com/andrelopes-code/equori/internal/platform/postgres"
)

var _ app.Catalog = (*Catalog)(nil)

// Catalog reads the database's own catalog for the diagnostic file.
type Catalog struct{ pool *pgxpool.Pool }

func NewCatalog(pool *pgxpool.Pool) *Catalog { return &Catalog{pool: pool} }

// Tables returns every user table with its estimated row count.
func (c *Catalog) Tables(ctx context.Context) ([]domain.Table, error) {
	rows, err := c.pool.Query(ctx, `SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname`)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}

	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Table, error) {
		var t domain.Table
		err := r.Scan(&t.Name, &t.Rows)

		return t, err
	})
}

// Server returns the PostgreSQL version, the locale provider and locale, and the schema version.
func (c *Catalog) Server(ctx context.Context) (domain.Server, error) {
	var s domain.Server

	if err := c.pool.QueryRow(ctx, `SELECT current_setting('server_version')`).Scan(&s.PostgresVersion); err != nil {
		return domain.Server{}, fmt.Errorf("read server version: %w", err)
	}

	var err error

	if s.LocaleProvider, s.Locale, err = platformpostgres.Locale(ctx, c.pool); err != nil {
		return domain.Server{}, err
	}

	if s.Schema, _, err = platformpostgres.Pending(ctx, c.pool); err != nil {
		return domain.Server{}, err
	}

	return s, nil
}
