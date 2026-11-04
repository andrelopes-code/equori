// Package pgtest provides an isolated, migrated PostgreSQL database per test.
package pgtest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/db"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const envURL = "EQUORI_TEST_DATABASE_URL"

// New creates a database on the server at EQUORI_TEST_DATABASE_URL, applies all
// migrations and drops the database when the test ends.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	return create(t, template(t))
}

// templates holds, per process, the migrated database every New copies: copying a database
// takes milliseconds, migrating one takes seconds.
var templates struct {
	once sync.Once
	name string
	err  error
}

// template returns the name of a database migrated to the embedded migrations. Its name
// carries a digest of the migrations, so test processes share it and a changed migration
// gets a new one; an advisory lock makes one process build it.
func template(t testing.TB) string {
	t.Helper()
	templates.once.Do(func() { templates.name, templates.err = buildTemplate() })

	if templates.err != nil {
		t.Fatalf("template database: %v", templates.err)
	}

	return templates.name
}

func buildTemplate() (string, error) {
	sum := sha256.New()
	if err := fs.WalkDir(db.Migrations, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}

		b, err := db.Migrations.ReadFile(path)
		sum.Write([]byte(path))
		sum.Write(b)

		return err
	}); err != nil {
		return "", err
	}

	name := "template_" + hex.EncodeToString(sum.Sum(nil))[:16]
	ctx := context.Background()

	admin, err := connectAdmin(ctx)
	if err != nil {
		return "", err
	}
	defer admin.Close(ctx)

	if _, err := admin.Exec(ctx, "SELECT pg_advisory_lock(hashtextextended($1, 0))", name); err != nil {
		return "", err
	}

	defer admin.Exec(ctx, "SELECT pg_advisory_unlock(hashtextextended($1, 0))", name) //nolint:errcheck // the session ends next

	var ready bool
	if err := admin.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1 AND datistemplate)", name).Scan(&ready); err != nil || ready {
		return name, err
	}

	if _, err := admin.Exec(ctx, "DROP DATABASE IF EXISTS "+name); err != nil {
		return "", err
	}

	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		return "", err
	}

	cfg, err := pgxpool.ParseConfig(os.Getenv(envURL))
	if err != nil {
		return "", err
	}

	cfg.ConnConfig.Database = name

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return "", err
	}

	err = postgres.Migrate(ctx, pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	pool.Close()

	if err != nil {
		return "", fmt.Errorf("prepare template: %w", err)
	}

	// Marked last: a database left by an interrupted build is not a template and is rebuilt.
	_, err = admin.Exec(ctx, "ALTER DATABASE "+name+" WITH IS_TEMPLATE true")

	return name, err
}

func connectAdmin(ctx context.Context) (*pgx.Conn, error) {
	adminURL := os.Getenv(envURL)
	if adminURL == "" {
		return nil, fmt.Errorf("%s is not set; run tests with make test", envURL)
	}

	cfg, err := pgx.ParseConfig(adminURL)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", envURL, err)
	}

	return pgx.ConnectConfig(ctx, cfg)
}

func Empty(t testing.TB) *pgxpool.Pool {
	t.Helper()
	return create(t, "")
}

// create makes a database for the test, copied from template when it is not empty, and
// drops it at the end of the test.
func create(t testing.TB, template string) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()

	admin, err := connectAdmin(ctx)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = admin.Close(context.Background()) })

	name := "test_" + strings.ToLower(rand.Text())

	stmt := "CREATE DATABASE " + name
	if template != "" {
		// FILE_COPY copies the files instead of logging each block: on the in-memory test
		// server, 16 concurrent copies took 552 ms against 1346 ms with the default WAL_LOG.
		stmt += " TEMPLATE " + template + " STRATEGY FILE_COPY"
	}

	if _, err := admin.Exec(ctx, stmt); err != nil {
		t.Fatalf("create database: %v", err)
	}

	t.Cleanup(func() {
		_, err := admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
		if err != nil {
			t.Errorf("drop database %s: %v", name, err)
		}
	})

	poolCfg, err := pgxpool.ParseConfig(os.Getenv(envURL))
	if err != nil {
		t.Fatal(err)
	}

	poolCfg.ConnConfig.Database = name

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}

	t.Cleanup(pool.Close)

	return pool
}

// CreateMember inserts a member (language en) with a unique email, a book of region US and an owner membership.
func CreateMember(t testing.TB, pool *pgxpool.Pool) (memberID, booksID int64) {
	t.Helper()

	email := strings.ToLower(rand.Text()) + "@example.com"

	err := pool.QueryRow(context.Background(),
		`INSERT INTO identity_member (email, password_hash, role, language) VALUES ($1, 'x', 'admin', 'en') RETURNING id`, email).Scan(&memberID)
	if err != nil {
		t.Fatalf("create member: %v", err)
	}

	if err := pool.QueryRow(context.Background(), `INSERT INTO identity_books (region, name) VALUES ('US', 'test') RETURNING id`).Scan(&booksID); err != nil {
		t.Fatalf("create books: %v", err)
	}

	if _, err := pool.Exec(context.Background(),
		`INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'owner')`, memberID, booksID); err != nil {
		t.Fatalf("create membership: %v", err)
	}

	return memberID, booksID
}

// CreateBooks returns the books ID of CreateMember.
func CreateBooks(t testing.TB, pool *pgxpool.Pool) int64 {
	t.Helper()
	_, booksID := CreateMember(t, pool)

	return booksID
}

// CreateUserBeforeBooks inserts an identity_user row (language en, region US) in a schema migrated below version 69.
func CreateUserBeforeBooks(t testing.TB, pool *pgxpool.Pool) int64 {
	t.Helper()
	var id int64
	email := strings.ToLower(rand.Text()) + "@example.com"

	err := pool.QueryRow(context.Background(),
		`INSERT INTO identity_user (email, password_hash, role, language, region) VALUES ($1, 'x', 'admin', 'en', 'US') RETURNING id`, email).Scan(&id)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	return id
}

// CreateUserBeforeProfile inserts an identity_user row in a schema migrated below version 39, which has no language and region.
func CreateUserBeforeProfile(t testing.TB, pool *pgxpool.Pool) int64 {
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
