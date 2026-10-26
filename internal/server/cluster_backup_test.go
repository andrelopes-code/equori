//go:build cluster

package server_test

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// B4 of the distribution design: a dump of the compose form restores into a managed cluster and
// back, with every fact and derived value of N12.
func TestClusterBackupRestoresAcrossForms(t *testing.T) {
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	h := apitest.New(t, apitest.Today("2026-11-20"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -23000), apitest.Posting(food, 23000))
	h.Dispatch()
	want := snapshot(t, h.Pool)
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	external := dsnOf(h.Pool)

	dump := filepath.Join(t.TempDir(), "compose.dump")
	if err := backup.Dump(t.Context(), bin, external, dump); err != nil {
		t.Fatal(err)
	}
	c, err := pgcluster.Start(t.Context(), t.TempDir(), bin)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Stop() }()
	if err := backup.Restore(t.Context(), bin, c.DSN(pgcluster.Database), dump, latest); err != nil {
		t.Fatal(err)
	}
	managed, err := postgres.Open(t.Context(), c.DSN(pgcluster.Database))
	if err != nil {
		t.Fatal(err)
	}
	defer managed.Close()
	if got := snapshot(t, managed); !slices.Equal(got, want) {
		t.Fatalf("compose to managed differs:\n got %v\nwant %v", got, want)
	}

	back := filepath.Join(t.TempDir(), "managed.dump")
	if err := backup.Dump(t.Context(), bin, c.DSN(pgcluster.Database), back); err != nil {
		t.Fatal(err)
	}
	target := pgtest.Empty(t)
	if err := backup.Restore(t.Context(), bin, dsnOf(target), back, latest); err != nil {
		t.Fatal(err)
	}
	target.Reset()
	if got := snapshot(t, target); !slices.Equal(got, want) {
		t.Fatalf("managed to compose differs:\n got %v\nwant %v", got, want)
	}
}

// ConnConfig.ConnString returns the string given to ParseConfig, which names the server's
// maintenance database, not the database pgtest created.
func dsnOf(pool *pgxpool.Pool) string {
	cc := pool.Config().ConnConfig
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", cc.Host, cc.Port, cc.User, cc.Password, cc.Database)
}
