//go:build cluster

package server_test

import (
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// exchangeEnv names the directory where one operating system leaves <GOOS>.dump and
// <GOOS>.snapshot for another (W-R2 of the Windows design); only the CI exchange jobs set it.
func exchangeEnv(t *testing.T) (dir, bin string) {
	t.Helper()
	dir, bin = os.Getenv("EQUORI_TEST_EXCHANGE"), os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if dir == "" || bin == "" {
		t.Fatal("EQUORI_TEST_EXCHANGE and EQUORI_TEST_POSTGRES_BIN must be set; run make test-exchange")
	}
	return dir, bin
}

// TestExchangeDump writes the dataset of TestClusterBackupRestoresAcrossForms as a dump of this
// operating system, with its N12 snapshot.
func TestExchangeDump(t *testing.T) {
	dir, bin := exchangeEnv(t)
	h := apitest.New(t, apitest.Today("2026-11-20"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -23000), apitest.Posting(food, 23000))
	h.Dispatch()
	want := snapshot(t, h.Pool)
	if err := backup.Dump(t.Context(), bin, dsnOf(h.Pool), filepath.Join(dir, runtime.GOOS+".dump")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, runtime.GOOS+".snapshot"), []byte(strings.Join(want, "\n")+"\n"), 0o644); err != nil { //nolint:gosec // G306: the CI reads it back as another user.
		t.Fatal(err)
	}
}

// B4 across operating systems: a dump of another operating system restores into a managed
// cluster and into an external database with every fact and derived value of N12.
func TestExchangeRestore(t *testing.T) {
	dir, bin := exchangeEnv(t)
	dumps, err := filepath.Glob(filepath.Join(dir, "*.dump"))
	if err != nil {
		t.Fatal(err)
	}
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	restored := 0
	for _, dump := range dumps {
		goos := strings.TrimSuffix(filepath.Base(dump), ".dump")
		if goos == runtime.GOOS {
			continue
		}
		b, err := os.ReadFile(strings.TrimSuffix(dump, ".dump") + ".snapshot")
		if err != nil {
			t.Fatal(err)
		}
		want := strings.Split(strings.TrimSuffix(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n"), "\n")

		c, err := pgcluster.Start(t.Context(), t.TempDir(), bin)
		if err != nil {
			t.Fatal(err)
		}
		if err := backup.Restore(t.Context(), bin, c.DSN(pgcluster.Database), dump, latest); err != nil {
			t.Fatal(err)
		}
		managed, err := postgres.Open(t.Context(), c.DSN(pgcluster.Database))
		if err != nil {
			t.Fatal(err)
		}
		if got := snapshot(t, managed); !slices.Equal(got, want) {
			t.Fatalf("%s dump in a managed cluster differs:\n got %v\nwant %v", goos, got, want)
		}
		managed.Close()
		if err := c.Stop(); err != nil {
			t.Fatal(err)
		}

		target := pgtest.Empty(t)
		if err := backup.Restore(t.Context(), bin, dsnOf(target), dump, latest); err != nil {
			t.Fatal(err)
		}
		target.Reset()
		if got := snapshot(t, target); !slices.Equal(got, want) {
			t.Fatalf("%s dump in an external database differs:\n got %v\nwant %v", goos, got, want)
		}
		restored++
	}
	if restored == 0 {
		t.Fatalf("no dump of another operating system in %s", dir)
	}
}
