package postgres_test

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/db"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestMigrate(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	if err := pool.Ping(t.Context()); err != nil {
		t.Fatalf("ping migrated database: %v", err)
	}
}

// The migration files are numbered 1 to N without gaps, so the highest version is their count.
func TestLatestVersion(t *testing.T) {
	t.Parallel()
	files, err := fs.Glob(db.Migrations, "migrations/*.sql")
	if err != nil {
		t.Fatal(err)
	}
	got, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	if got != int64(len(files)) {
		t.Fatalf("LatestVersion() = %d, want %d", got, len(files))
	}
}

// V4 of the distribution design: a database migrated by a newer binary is refused, untouched.
func TestMigrateRefusesNewerSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	ahead := latest + 1
	if _, err := pool.Exec(t.Context(), "INSERT INTO goose_db_version (version_id, is_applied) VALUES ($1, true)", ahead); err != nil {
		t.Fatal(err)
	}
	err = postgres.Migrate(t.Context(), pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if !errors.Is(err, postgres.ErrSchemaAhead) {
		t.Fatalf("Migrate() error = %v, want ErrSchemaAhead", err)
	}
	for _, want := range []string{fmt.Sprintf("version %d", ahead), fmt.Sprintf("up to %d", latest)} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q does not contain %q", err, want)
		}
	}
}

func TestMigrateAcceptsEmptyDatabase(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	if err := postgres.Migrate(t.Context(), pool, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatalf("Migrate() on an empty database: %v", err)
	}
}

func TestPending(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	discard := slog.New(slog.NewTextHandler(io.Discard, nil))
	empty := pgtest.Empty(t)
	if _, pending, err := postgres.Pending(ctx, empty); err != nil || pending {
		t.Fatalf("empty database: pending %v, %v; want false", pending, err)
	}
	if err := postgres.MigrateTo(ctx, empty, 5, discard); err != nil {
		t.Fatal(err)
	}
	if current, pending, err := postgres.Pending(ctx, empty); err != nil || !pending || current != 5 {
		t.Fatalf("at version 5: %d, %v, %v; want 5, true", current, pending, err)
	}
	if _, pending, err := postgres.Pending(ctx, pgtest.New(t)); err != nil || pending {
		t.Fatalf("migrated: pending %v, %v; want false", pending, err)
	}
}

// The compose and test servers run postgres:18-alpine; musl orders by code point, as the builtin
// provider of managed mode does (ADR 022, M4). A failure here disproves that premise: stop and report.
func TestTestServerOrdersByCodePoint(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	var got string
	if err := pool.QueryRow(t.Context(), "SELECT string_agg(x, ',' ORDER BY x) FROM (VALUES ('banco'), ('Água'), ('Zebra'), ('Banco')) v(x)").Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "Banco,Zebra,banco,Água" {
		t.Fatalf("order = %q", got)
	}
}

func TestLocale(t *testing.T) {
	t.Parallel()
	provider, _, err := postgres.Locale(t.Context(), pgtest.New(t))
	if err != nil || provider != "c" {
		t.Fatalf("Locale() provider = %q, %v; want %q (libc)", provider, err, "c")
	}
}
