//go:build cluster

package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// B1 and B3: a backup holds the database as it was; equori backup never migrates it first.
func TestClusterBackupDoesNotMigrate(t *testing.T) {
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	pool := pgtest.Empty(t)
	if err := postgres.MigrateTo(t.Context(), pool, 5, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	cc := pool.Config().ConnConfig
	t.Setenv("EQUORI_DATABASE_URL", fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", cc.Host, cc.Port, cc.User, cc.Password, cc.Database))
	t.Setenv("EQUORI_POSTGRES_BIN", bin)
	if err := backupCommand([]string{"--out", filepath.Join(t.TempDir(), "b.dump")}); err != nil {
		t.Fatal(err)
	}
	if current, _, err := postgres.Pending(t.Context(), pool); err != nil || current != 5 {
		t.Fatalf("schema version after equori backup = %d, %v; want 5", current, err)
	}
}
