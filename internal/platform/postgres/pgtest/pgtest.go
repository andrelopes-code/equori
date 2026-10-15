// Package pgtest provides an isolated, migrated PostgreSQL database per test.
package pgtest

import (
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const envURL = "EQUORI_TEST_DATABASE_URL"

// New creates a database on the server at EQUORI_TEST_DATABASE_URL, applies all
// migrations and drops the database when the test ends.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	adminURL := os.Getenv(envURL)
	if adminURL == "" {
		t.Fatalf("%s is not set; run tests with make test", envURL)
	}
	ctx := context.Background()

	cfg, err := pgx.ParseConfig(adminURL)
	if err != nil {
		t.Fatalf("parse %s: %v", envURL, err)
	}
	admin, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("connect admin: %v", err)
	}
	t.Cleanup(func() { _ = admin.Close(context.Background()) })

	name := "test_" + strings.ToLower(rand.Text())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		_, err := admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
		if err != nil {
			t.Errorf("drop database %s: %v", name, err)
		}
	})

	poolCfg, err := pgxpool.ParseConfig(adminURL)
	if err != nil {
		t.Fatal(err)
	}
	poolCfg.ConnConfig.Database = name
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := postgres.Migrate(ctx, pool, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return pool
}

// CreateUser inserts an identity_user row with a unique email and returns its id.
func CreateUser(t testing.TB, pool *pgxpool.Pool) int64 {
	t.Helper()
	var id int64
	email := strings.ToLower(rand.Text()) + "@example.com"
	err := pool.QueryRow(context.Background(),
		`INSERT INTO identity_user (email, password_hash, role) VALUES ($1, 'x', 'admin') RETURNING id`, email).Scan(&id)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return id
}
