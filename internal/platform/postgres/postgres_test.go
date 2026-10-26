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
